-- Public marketplace helpers. SECURITY DEFINER functions return aggregate,
-- non-sensitive values for PUBLISHED listings only. They run as the owner,
-- so they set a platform context internally (FORCE RLS applies to the owner).

create or replace function public_available_units(p_listing uuid, p_start timestamptz, p_end timestamptz)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  perform set_config('app.platform_admin', 'on', true);
  select count(*) into n
    from units u join listings l on l.id = u.listing_id
   where u.listing_id = p_listing and l.is_published
     and u.status not in ('retired','unavailable','damaged')
     and not exists (
       select 1 from allocations a
        where a.unit_id = u.id and a.active
          and a.blocked && tstzrange(p_start, p_end + make_interval(mins => l.buffer_minutes)));
  perform set_config('app.platform_admin', '', true);
  return n;
end $$;

create or replace function public_location_city(p_org uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  if not exists (select 1 from listings where org_id = p_org and is_published) then return null; end if;
  perform set_config('app.platform_admin', 'on', true);
  select city into c from locations where org_id = p_org order by is_default desc limit 1;
  perform set_config('app.platform_admin', '', true);
  return c;
end $$;

revoke all on function public_available_units(uuid, timestamptz, timestamptz) from public;
revoke all on function public_location_city(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'rentora_app') then
    grant execute on function public_available_units(uuid, timestamptz, timestamptz) to rentora_app;
    grant execute on function public_location_city(uuid) to rentora_app;
  end if;
end $$;
