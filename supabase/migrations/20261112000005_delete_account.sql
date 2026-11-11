-- Account deletion (GDPR art. 17). Not applied automatically: review and apply in the morning.
-- Organizations where the user is the only member are deleted together with all their data.
-- If the user is the last owner of an organization that has other members, deletion is blocked
-- until ownership is transferred.
-- TODO: preveri – EUDR art. 12/13 asks to keep records for 5 years; the UI asks the user to download
-- the archive first. Whether the operator may delete earlier is the operator's responsibility.
create function public.delete_my_account(p_dry_run boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  blocked text[];
  solo uuid[];
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select coalesce(array_agg(o.name order by o.name), '{}') into blocked
  from public.organizations o
  join public.memberships me on me.organization_id = o.id and me.user_id = uid and me.role = 'owner'
  where not exists (select 1 from public.memberships m where m.organization_id = o.id and m.role = 'owner' and m.user_id <> uid)
    and exists (select 1 from public.memberships m where m.organization_id = o.id and m.user_id <> uid);

  select coalesce(array_agg(me.organization_id), '{}') into solo
  from public.memberships me
  where me.user_id = uid
    and not exists (select 1 from public.memberships m where m.organization_id = me.organization_id and m.user_id <> uid);

  if not p_dry_run then
    if cardinality(blocked) > 0 then
      raise exception 'Transfer ownership first' using errcode = 'P0001', hint = 'LT_TRANSFER_OWNERSHIP';
    end if;
    delete from public.organizations where id = any (solo);
    delete from public.audit_log where organization_id = any (solo);
    delete from auth.users where id = uid;
  end if;

  return jsonb_build_object('blocked', to_jsonb(blocked), 'solo', to_jsonb(solo));
end;
$$;
revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;
