-- Minimal public card for a scanned QR code. Returns equipment name and the
-- owning business's public contact only: no status, customers, prices or history.
create or replace function public_unit_card(p_token text)
returns table (org_id uuid, listing_title text, provider_name text, provider_phone text, listing_slug text, provider_slug text, is_published boolean)
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_token !~ '^[a-f0-9]{24}$' then return; end if;
  perform set_config('app.platform_admin', 'on', true);
  return query
    select u.org_id, l.title, o.name, o.phone, l.slug, o.slug, l.is_published
      from units u join listings l on l.id = u.listing_id join organizations o on o.id = u.org_id
     where u.qr_token = p_token and u.status <> 'retired';
  perform set_config('app.platform_admin', '', true);
end $$;
revoke all on function public_unit_card(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'rentora_app') then
    grant execute on function public_unit_card(text) to rentora_app;
  end if;
end $$;
