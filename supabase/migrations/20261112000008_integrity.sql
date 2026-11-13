-- Integrity fixes from the code review (2026-11-12). Only creates/replaces functions and adds triggers.

-- 1. Shipment children are replaced in ONE transaction; plot geometry is snapshotted in the database
--    (no 1000-row limit, no geometry round trip). Security invoker: RLS applies as usual.
create function public.save_shipment_children(
  p_shipment uuid, p_items jsonb, p_plot_ids uuid[], p_document_ids uuid[], p_references jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
begin
  select s.organization_id into v_org from public.shipments s where s.id = p_shipment;
  if v_org is null then
    raise exception 'Shipment not found' using errcode = 'P0002';
  end if;
  delete from public.shipment_items where shipment_id = p_shipment;
  delete from public.shipment_plots where shipment_id = p_shipment;
  delete from public.shipment_documents where shipment_id = p_shipment;
  delete from public.upstream_references where shipment_id = p_shipment;

  insert into public.shipment_items (organization_id, shipment_id, product_id, net_mass_kg, volume_m3, pieces, plot_ids)
  select v_org, p_shipment, (x ->> 'productId')::uuid, (x ->> 'netMassKg')::numeric, (x ->> 'volumeM3')::numeric, (x ->> 'pieces')::integer,
         (select nullif(array_agg(v::uuid), '{}') from jsonb_array_elements_text(coalesce(x -> 'plotIds', '[]'::jsonb)) v)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;

  insert into public.shipment_plots (organization_id, shipment_id, plot_id, geom_snapshot)
  select v_org, p_shipment, p.id, p.geom
  from public.plots p
  where p.organization_id = v_org and p.id = any (coalesce(p_plot_ids, '{}'));

  insert into public.shipment_documents (organization_id, shipment_id, document_id)
  select v_org, p_shipment, d.id
  from public.documents d
  where d.organization_id = v_org and d.id = any (coalesce(p_document_ids, '{}'));

  insert into public.upstream_references (organization_id, shipment_id, kind, reference_no, verification_no, supplier_id)
  select v_org, p_shipment, (x ->> 'kind')::public.upstream_ref_kind, x ->> 'referenceNo', nullif(x ->> 'verificationNo', ''), (x ->> 'supplierId')::uuid
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) x;
end;
$$;
revoke all on function public.save_shipment_children(uuid, jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.save_shipment_children(uuid, jsonb, uuid[], uuid[], jsonb) to authenticated;

-- 2. Document ↔ plot links in one transaction: add the new links, then remove the ones no longer wanted.
create function public.set_document_plots(p_document uuid, p_plot_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
begin
  select d.organization_id into v_org from public.documents d where d.id = p_document;
  if v_org is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  insert into public.plot_documents (organization_id, plot_id, document_id)
  select v_org, p.id, p_document from public.plots p
  where p.organization_id = v_org and p.id = any (coalesce(p_plot_ids, '{}'))
  on conflict (plot_id, document_id) do nothing;
  delete from public.plot_documents
  where document_id = p_document and not (plot_id = any (coalesce(p_plot_ids, '{}')));
end;
$$;
revoke all on function public.set_document_plots(uuid, uuid[]) from public, anon;
grant execute on function public.set_document_plots(uuid, uuid[]) to authenticated;

-- 3. Shipment status rules in the database (not only in the app):
--    submitted only from ready and with a DDS reference; a submitted shipment is read-only except
--    for marking it rejected; children of a submitted shipment cannot change.
create function private.shipment_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'submitted' then
    if new.status not in ('submitted', 'rejected')
       or (to_jsonb(new) - array['status', 'updated_at', 'traces_status', 'traces_message', 'traces_checked_at'])
          is distinct from (to_jsonb(old) - array['status', 'updated_at', 'traces_status', 'traces_message', 'traces_checked_at']) then
      raise exception 'A submitted shipment is read-only' using errcode = 'P0001', hint = 'LT_SHIPMENT_LOCKED';
    end if;
  elsif new.status = 'submitted' then
    if old.status <> 'ready' or coalesce(trim(new.dds_reference_no), '') = '' then
      raise exception 'Only a ready shipment with a DDS reference can be submitted' using errcode = 'P0001', hint = 'LT_SHIPMENT_NOT_READY';
    end if;
  end if;
  return new;
end;
$$;
create trigger shipments_guard before update on public.shipments
  for each row execute function private.shipment_guard();

create function private.shipment_child_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.shipments s
    where s.id = coalesce(new.shipment_id, old.shipment_id) and s.status = 'submitted'
  ) then
    raise exception 'A submitted shipment is read-only' using errcode = 'P0001', hint = 'LT_SHIPMENT_LOCKED';
  end if;
  return coalesce(new, old);
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['shipment_items', 'shipment_plots', 'shipment_documents', 'upstream_references'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function private.shipment_child_guard()', t || '_locked', t);
  end loop;
end;
$$;

-- 4. Revoking a buyer link is final (members cannot un-revoke an owner's revocation).
create function private.buyer_share_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'A revoked link cannot be restored' using errcode = 'P0001';
  end if;
  if new.expires_at > old.expires_at then
    raise exception 'A link cannot be extended; create a new one' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger buyer_shares_guard before update on public.buyer_shares
  for each row execute function private.buyer_share_guard();

-- 5. Buyer package: record a view at most once per hour (no unbounded audit rows) and include the
--    supplier of each plot (ProducerName in the buyer's GeoJSON).
create or replace function public.buyer_package(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_share public.buyer_shares;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_share from public.buyer_shares s
  where s.token_hash = extensions.digest(p_token, 'sha256') and s.revoked_at is null and s.expires_at > now();
  if not found then
    return null;
  end if;

  if v_share.last_viewed_at is null or v_share.last_viewed_at < now() - interval '1 hour' then
    update public.buyer_shares set last_viewed_at = now() where id = v_share.id;
  end if;

  select jsonb_build_object(
    'expires_at', v_share.expires_at,
    'include_documents', v_share.include_documents,
    'organization', (select jsonb_build_object('name', o.name, 'country', o.country, 'tax_id', o.tax_id, 'registration_no', o.registration_no, 'eori', o.eori, 'address', o.address)
                     from public.organizations o where o.id = v_share.organization_id),
    'shipments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'internal_ref', s.internal_ref,
        'shipment_date', s.shipment_date,
        'status', s.status,
        'activity', s.activity,
        'country_of_production', s.country_of_production,
        'dds_reference_no', s.dds_reference_no,
        'dds_verification_no', s.dds_verification_no,
        'customer', (select c.name from public.customers c where c.id = s.customer_id),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product', p.name, 'hs_code', p.hs_code, 'trade_name', p.trade_name, 'scientific_name', sp.scientific_name,
            'net_mass_kg', i.net_mass_kg, 'volume_m3', i.volume_m3, 'pieces', i.pieces) order by p.name)
          from public.shipment_items i join public.products p on p.id = i.product_id left join public.species sp on sp.id = p.species_id
          where i.shipment_id = s.id), '[]'::jsonb),
        'plots', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', pl.label, 'country', pl.country, 'area_ha', pl.area_ha,
            'supplier', case when v_share.show_suppliers then (select su.name from public.suppliers su where su.id = pl.supplier_id) end,
            'harvest_from', pl.harvest_from, 'harvest_to', pl.harvest_to,
            'geometry', extensions.st_asgeojson(sp2.geom_snapshot, 6)::jsonb) order by pl.label)
          from public.shipment_plots sp2 join public.plots pl on pl.id = sp2.plot_id
          where sp2.shipment_id = s.id and sp2.geom_snapshot is not null), '[]'::jsonb),
        'documents', case when v_share.include_documents then coalesce((
          select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'type', d.type, 'valid_from', d.valid_from, 'valid_to', d.valid_to) order by d.title)
          from public.shipment_documents sd join public.documents d on d.id = sd.document_id
          where sd.shipment_id = s.id), '[]'::jsonb) else '[]'::jsonb end
      ) order by s.internal_ref)
      from public.shipments s
      where s.organization_id = v_share.organization_id and s.id = any (v_share.shipment_ids)), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- 6. Invitations: only a confirmed e-mail address can accept (with "Confirm email" off, Supabase confirms
--    automatically – TODO: preveri, switch it on in production). An invitation as owner promotes an existing member.
create or replace function public.invitation_info(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  if (select auth.uid()) is null or p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v from public.invitations i
  where i.token_hash = extensions.digest(p_token, 'sha256') and i.accepted_at is null and i.expires_at > now();
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'organization', (select o.name from public.organizations o where o.id = v.organization_id),
    'role', v.role,
    'email', v.email,
    'email_matches', exists (
      select 1 from auth.users u
      where u.id = (select auth.uid()) and lower(u.email) = lower(v.email) and u.email_confirmed_at is not null
    ),
    'already_member', exists (select 1 from public.memberships m where m.organization_id = v.organization_id and m.user_id = (select auth.uid()))
  );
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v public.invitations;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into v from public.invitations i
  where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and i.accepted_at is null and i.expires_at > now()
  for update;
  if not found then
    raise exception 'Invitation not valid' using errcode = 'P0001', hint = 'LT_INVITATION_INVALID';
  end if;
  if not exists (
    select 1 from auth.users u where u.id = uid and lower(u.email) = lower(v.email) and u.email_confirmed_at is not null
  ) then
    raise exception 'Invitation is for another e-mail' using errcode = 'P0001', hint = 'LT_INVITATION_EMAIL';
  end if;
  insert into public.memberships (organization_id, user_id, role)
  values (v.organization_id, uid, v.role)
  on conflict (organization_id, user_id) do update
    set role = case when excluded.role = 'owner' then 'owner'::public.member_role else public.memberships.role end;
  update public.invitations set accepted_at = now() where id = v.id;
  return v.organization_id;
end;
$$;
