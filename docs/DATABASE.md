# Database

PostgreSQL ≥ 15 with extensions `pgcrypto`, `citext`, `btree_gist`.

| Migration | Contents |
|---|---|
| 0001_core | users, sessions, plans, categories, organizations, members, locations, counters, listings, units (+history), customers, reservations, reservation items, allocations (exclusion constraint), audit log, RLS |
| 0002 | plan + category reference data, `user_organizations()`, grants for `rentora_app` |
| 0003 | default privileges for future tables |
| 0004 | members can read their organizations (`app.user_id`) |
| 0005 | public marketplace functions (`public_available_units`, `public_location_city`) |
| 0006 | `public_unit_card()` for QR scans by non-members |

## Rules
- Migrations are **forward-only** and checksummed; editing an applied file fails the runner. Create a new file instead.
- Every new tenant table must: have `org_id`, composite `unique (org_id, id)` for tenant-safe foreign keys, `enable` + `force` RLS with the `tenant_isolation` policy.
- Money is integer cents; currency on the row.
- Never `delete` business records in application code; use statuses (`retired`, `cancelled`).

## Backups and rollback
- Before applying migrations in production: `pg_dump -Fc` (or provider snapshot / PITR) — verify restore in staging.
- Rollback strategy: restore from snapshot, or ship a compensating forward migration. Destructive DDL (drop column/table) requires a two-step release (stop using → drop later).
