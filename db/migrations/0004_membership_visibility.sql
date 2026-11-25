-- Members can read the organizations they belong to (org switcher / login),
-- resolved through app.user_id which the server sets from the verified session.
create or replace function app_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create policy org_member_read on organizations for select
  using (exists (select 1 from org_members m where m.org_id = organizations.id and m.user_id = app_user_id() and m.status = 'active'));

-- Replace the definer function (FORCE RLS applies to the owner too) with an invoker version.
create or replace function user_organizations(p_user_id uuid)
returns table (id uuid, name text, slug text, role text, plan_code text)
language sql stable security invoker set search_path = public as $$
  select o.id, o.name, o.slug, m.role, o.plan_code
  from org_members m join organizations o on o.id = m.org_id
  where m.user_id = p_user_id and m.status = 'active'
  order by o.name
$$;
