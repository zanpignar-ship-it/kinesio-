#!/usr/bin/env bash
# Run the database tests against a throw-away PostGIS in Docker.
# Applies supabase/tests/shim.sql (local Supabase stand-in), all migrations and the reference seed.
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=lestrace-db-test
PORT=54329
IMAGE=postgis/postgis:16-3.4
DB=lestrace_test
export PGHOST=127.0.0.1 PGPORT=$PORT PGUSER=postgres PGPASSWORD=postgres

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running." >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null
fi
for _ in $(seq 1 60); do
  if pg_isready -q -d postgres && psql -qtAc 'select 1' -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

psql -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template template0"
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/seed/reference.sql

export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:$PORT/$DB"
npx vitest run -c vitest.db.config.ts "$@"
