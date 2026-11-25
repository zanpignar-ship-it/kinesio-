-- Ensure future tables/sequences created by the owner are usable by the app role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'rentora_app') then
    alter default privileges in schema public grant select, insert, update, delete on tables to rentora_app;
    alter default privileges in schema public grant usage, select on sequences to rentora_app;
    alter default privileges in schema public grant execute on functions to rentora_app;
  end if;
end $$;
