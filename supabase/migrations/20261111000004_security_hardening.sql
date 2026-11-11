-- Security hardening after review:
--  1. users cannot choose organization ids (a deleted organization's id must never be reusable);
--  2. organization_id (and link endpoints) are immutable;
--  3. organization links: owners create them, always pending; only the partner's owner activates; either side revokes;
--  4. buyer_shares.shipment_ids must belong to the same organization;
--  5. created_by is always the acting user and never changes; creators no longer see an organization after leaving it;
--  6. deleting a user account works; the oldest remaining member becomes owner if the last owner disappears;
--  7. invitation e-mail and token hash are not copied into the audit log.

-- 1 + 5: organizations get a server-chosen id and the real creator.
create function private.organizations_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    new.id := gen_random_uuid();
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;
create trigger organizations_before_insert before insert on public.organizations
  for each row execute function private.organizations_before_insert();

-- The creator may read the row only while it has no members yet (needed for INSERT … RETURNING, which is
-- checked before the after-insert trigger adds the owner membership). Once anyone is a member, membership decides.
create function private.org_has_members(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.organization_id = org)
$$;
revoke all on function private.org_has_members(uuid) from public, anon;
grant execute on function private.org_has_members(uuid) to authenticated;

alter policy organizations_select on public.organizations
  using (
    id in (select private.user_org_ids())
    or (created_by = (select auth.uid()) and not private.org_has_members(id))
  );

-- 5: created_by is the acting user on insert and is never changed afterwards.
create function private.stamp_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

-- 2: rows never move between organizations.
create function private.forbid_org_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['invitations', 'suppliers', 'plot_imports', 'plots', 'documents', 'shipments', 'buyer_shares'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.stamp_created_by()', t || '_created_by', t);
  end loop;
  foreach t in array array['memberships', 'invitations', 'suppliers', 'organization_links', 'customers', 'products', 'plot_imports',
                           'plots', 'documents', 'plot_documents', 'shipments', 'shipment_items', 'shipment_plots',
                           'shipment_documents', 'upstream_references', 'buyer_shares'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.forbid_org_change()', t || '_org_immutable', t);
  end loop;
end;
$$;

-- 3: organization links.
create function private.organization_links_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return new; -- service role / migrations
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    return new;
  end if;
  if new.partner_organization_id is distinct from old.partner_organization_id then
    raise exception 'partner_organization_id cannot be changed' using errcode = 'P0001';
  end if;
  if new.status = 'active' and old.status <> 'active'
     and new.partner_organization_id not in (select private.user_owner_org_ids()) then
    raise exception 'Only an owner of the partner organization can activate a link' using errcode = 'P0001';
  end if;
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'A revoked link cannot be reactivated' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger organization_links_guard before insert or update on public.organization_links
  for each row execute function private.organization_links_guard();

alter policy organization_links_insert on public.organization_links
  with check (organization_id in (select private.user_owner_org_ids()));
alter policy organization_links_update on public.organization_links
  using (organization_id in (select private.user_owner_org_ids()) or partner_organization_id in (select private.user_owner_org_ids()))
  with check (organization_id in (select private.user_owner_org_ids()) or partner_organization_id in (select private.user_owner_org_ids()));
alter policy organization_links_delete on public.organization_links
  using (organization_id in (select private.user_owner_org_ids()) or partner_organization_id in (select private.user_owner_org_ids()));

-- 4: shared shipments must belong to the organization of the share.
create function private.buyer_shares_check_shipments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.shipment_ids) as sid
    where not exists (select 1 from public.shipments s where s.id = sid and s.organization_id = new.organization_id)
  ) then
    raise exception 'Every shared shipment must belong to the organization' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger buyer_shares_check_shipments before insert or update of shipment_ids, organization_id on public.buyer_shares
  for each row execute function private.buyer_shares_check_shipments();

-- 6: deleting a user is always possible; keep an owner when members remain.
create or replace function private.keep_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     -- the organization itself is being deleted, or the user account is being deleted: allowed
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = old.organization_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'An organization must keep at least one owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create function private.promote_after_owner_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and not exists (select 1 from public.memberships m where m.organization_id = old.organization_id and m.role = 'owner') then
    update public.memberships set role = 'owner'
    where organization_id = old.organization_id
      and user_id = (
        select m.user_id from public.memberships m
        where m.organization_id = old.organization_id
        order by m.created_at, m.user_id limit 1
      );
  end if;
  return null;
end;
$$;
create trigger memberships_promote_owner after delete on public.memberships
  for each row execute function private.promote_after_owner_removed();

-- 7: redact invitation secrets in the audit log.
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  j jsonb := to_jsonb(coalesce(new, old));
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_table_name = 'invitations' then
    old_j := old_j - 'token_hash' - 'email';
    new_j := new_j - 'token_hash' - 'email';
  end if;
  insert into public.audit_log (organization_id, actor_id, table_name, row_id, action, old_data, new_data)
  values (
    (case when tg_table_name = 'organizations' then j ->> 'id' else j ->> 'organization_id' end)::uuid,
    (select auth.uid()),
    tg_table_name,
    coalesce(j ->> 'id', concat_ws(':', j ->> 'shipment_id', j ->> 'plot_id', j ->> 'document_id', j ->> 'user_id')),
    tg_op,
    old_j,
    new_j
  );
  return null;
end;
$$;
