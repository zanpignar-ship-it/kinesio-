-- Remove all e2e test users (e2e+...@lestrace.test) and the organizations only they belong to.
-- Run in the Supabase SQL editor (or via the MCP execute_sql tool) on the development project only.
begin;
create temp table e2e_users on commit drop as
  select id from auth.users where email like 'e2e+%@lestrace.test';
create temp table e2e_orgs on commit drop as
  select distinct m.organization_id as id from public.memberships m
  where m.user_id in (select id from e2e_users)
    and not exists (select 1 from public.memberships o where o.organization_id = m.organization_id and o.user_id not in (select id from e2e_users));
delete from storage.objects where bucket_id in ('documents', 'plot-imports') and (storage.foldername(name))[1] in (select id::text from e2e_orgs);
delete from public.organizations where id in (select id from e2e_orgs);
delete from auth.users where id in (select id from e2e_users);
delete from public.audit_log where organization_id in (select id from e2e_orgs);
commit;
