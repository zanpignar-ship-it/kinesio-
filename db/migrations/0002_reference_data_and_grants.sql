-- Reference data (idempotent) and privileges for the application role.

insert into subscription_plans (code, name, price_month_cents, price_year_cents, limits, features, sort) values
  ('basic', 'Basic', 4900, 49000, '{"units": 30, "locations": 1, "members": 3}',
     '["inventory","calendar","crm","basic_documents","basic_reports"]', 1),
  ('pro', 'Pro', 9900, 99000, '{"units": 2000, "locations": 3, "members": 25}',
     '["inventory","calendar","crm","basic_documents","basic_reports","passports","qr","agreements","pickup_return","maintenance","automations","advanced_reports","online_payments"]', 2),
  ('enterprise', 'Enterprise', 19900, 199000, '{"units": 20000, "locations": 100, "members": 500}',
     '["inventory","calendar","crm","basic_documents","basic_reports","passports","qr","agreements","pickup_return","maintenance","automations","advanced_reports","online_payments","multi_location","advanced_permissions","advanced_finance","api","white_label"]', 3)
on conflict (code) do nothing;

-- NOTE: the original site's exact 12 category names could not be verified
-- (host unreachable from the build environment). Adjust names freely; slugs are stable keys.
insert into categories (slug, sort, name_i18n, icon) values
  ('gradbena-mehanizacija', 1, '{"sl":"Gradbena mehanizacija","en":"Construction machinery"}', 'excavator'),
  ('dvizna-tehnika',        2, '{"sl":"Dvižna tehnika in odri","en":"Lifting & access"}', 'lift'),
  ('orodja',                3, '{"sl":"Električna orodja","en":"Power tools"}', 'drill'),
  ('rusenje-in-vrtanje',    4, '{"sl":"Rušenje in vrtanje","en":"Demolition & drilling"}', 'hammer'),
  ('zbijanje-tal',          5, '{"sl":"Zbijanje in obdelava tal","en":"Compaction & flooring"}', 'compactor'),
  ('energija',              6, '{"sl":"Agregati in energija","en":"Power generation"}', 'generator'),
  ('kompresorji',           7, '{"sl":"Kompresorji in pnevmatika","en":"Compressors"}', 'compressor'),
  ('prikolice',             8, '{"sl":"Prikolice in transport","en":"Trailers & transport"}', 'trailer'),
  ('kmetijstvo',            9, '{"sl":"Kmetijska mehanizacija","en":"Agricultural machinery"}', 'tractor'),
  ('vrt-in-okolica',       10, '{"sl":"Vrt in okolica","en":"Garden & landscaping"}', 'leaf'),
  ('ciscenje',             11, '{"sl":"Čiščenje","en":"Cleaning equipment"}', 'cleaning'),
  ('dogodki',              12, '{"sl":"Oprema za dogodke","en":"Event equipment"}', 'tent')
on conflict (slug) do nothing;

-- Organizations a user belongs to. SECURITY DEFINER because membership must
-- be resolved before a tenant context exists (org switcher, login).
create or replace function user_organizations(p_user_id uuid)
returns table (id uuid, name text, slug text, role text, plan_code text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.slug, m.role, o.plan_code
  from org_members m join organizations o on o.id = m.org_id
  where m.user_id = p_user_id and m.status = 'active'
  order by o.name
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'rentora_app') then
    grant usage on schema public to rentora_app;
    grant select, insert, update, delete on all tables in schema public to rentora_app;
    grant usage, select on all sequences in schema public to rentora_app;
    grant execute on all functions in schema public to rentora_app;
    -- reference data is read-only for the app; platform admin tooling writes via owner
    revoke insert, update, delete on subscription_plans, categories from rentora_app;
    -- audit log is append-only for the app
    revoke update, delete on audit_logs from rentora_app;
  end if;
end $$;
