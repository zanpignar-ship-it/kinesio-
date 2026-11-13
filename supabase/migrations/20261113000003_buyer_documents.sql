-- Buyers download the documents of a shared shipment without an account and without a service key:
-- buyer_document_access checks the share token and grants read access to that one file for 5 minutes;
-- the server then signs a short URL for it.

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

create table private.buyer_document_grants (
  object_name text not null,
  expires_at timestamptz not null
);
create index buyer_document_grants_name_idx on private.buyer_document_grants (object_name, expires_at);

create function public.buyer_document_access(p_token text, p_document_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_share public.buyer_shares;
  v_doc public.documents;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_share from public.buyer_shares s
  where s.token_hash = extensions.digest(p_token, 'sha256') and s.revoked_at is null and s.expires_at > now() and s.include_documents;
  if not found then
    return null;
  end if;
  select d.* into v_doc from public.documents d
  join public.shipment_documents sd on sd.document_id = d.id
  where d.id = p_document_id and d.organization_id = v_share.organization_id and sd.shipment_id = any (v_share.shipment_ids)
  limit 1;
  if not found then
    return null;
  end if;
  -- Expired grants are ignored by the policy. TODO: periodic cleanup (pg_cron) of old rows.
  insert into private.buyer_document_grants (object_name, expires_at) values (v_doc.file_path, now() + interval '5 minutes');
  return jsonb_build_object('path', v_doc.file_path, 'title', v_doc.title, 'mime', v_doc.mime);
end;
$$;
revoke all on function public.buyer_document_access(text, uuid) from public;
grant execute on function public.buyer_document_access(text, uuid) to anon, authenticated;

create function private.buyer_grant_allows(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.buyer_document_grants g where g.object_name = $1 and g.expires_at > now())
$$;
revoke all on function private.buyer_grant_allows(text) from public;
grant execute on function private.buyer_grant_allows(text) to anon, authenticated;

create policy documents_buyer_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'documents' and private.buyer_grant_allows(name));
