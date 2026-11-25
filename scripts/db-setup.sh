#!/usr/bin/env bash
# Local development bootstrap: creates the owner + application roles and the
# dev/test databases on a local PostgreSQL. Requires superuser access.
# On managed Postgres (Supabase, Neon, RDS) create the equivalent roles via the console.
set -euo pipefail
APP_PW="${RENTORA_APP_PASSWORD:-rentora_app_dev}"
OWNER_PW="${RENTORA_OWNER_PASSWORD:-rentora_owner_dev}"
psql_su() { if [ "$(id -u)" = 0 ]; then su postgres -c "psql -v ON_ERROR_STOP=1 -q $*"; else sudo -u postgres psql -v ON_ERROR_STOP=1 -q "$@"; fi; }

psql_su <<SQL
do \$do\$ begin
  if not exists (select 1 from pg_roles where rolname = 'rentora_owner') then
    create role rentora_owner login password '${OWNER_PW}';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'rentora_app') then
    create role rentora_app login password '${APP_PW}' nobypassrls;
  end if;
end \$do\$;
SQL

for db in rentora rentora_test; do
  exists=$(echo "select 1 from pg_database where datname='$db'" | psql_su -tA)
  if [ "$exists" != "1" ]; then echo "create database $db owner rentora_owner" | psql_su; fi
  echo "create extension if not exists pgcrypto; create extension if not exists citext; create extension if not exists btree_gist;" | psql_su -d "$db"
done
echo "Databases ready: rentora, rentora_test"
