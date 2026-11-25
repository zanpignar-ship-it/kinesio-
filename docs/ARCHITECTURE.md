# Architecture

RENTORA is a **modular monolith**: one Next.js application serving three surfaces over one PostgreSQL database.

| Surface | Path | Audience |
|---|---|---|
| Marketplace (public) | `/`, `/equipment`, `/business`, `/pricing`, `/p/[token]` | renters, prospects |
| RENTORA Business | `/app/**` | rental company staff |
| RENTORA Admin | _not built yet_ (`/admin`) | platform operators |

## Stack
Next.js 15 (App Router, React 19, Server Actions) · TypeScript strict · Tailwind CSS 4 with design tokens in `src/app/globals.css` · PostgreSQL 16 via `pg` (hand-written SQL, no ORM) · zod validation · Argon2id (`@node-rs/argon2`) · GSAP for motion · Vitest + Playwright.

An ORM was deliberately not used: the critical guarantees (exclusion constraints, RLS policies, security-definer functions) are PostgreSQL features best expressed in SQL migrations.

## Layers
```
src/app/**            routes, server components, server actions (thin: parse FormData → call service)
src/components/**     design system (ui.tsx, form.tsx), motion, icons
src/server/services/  business logic; every function takes an Actor and checks permissions
src/server/db.ts      withTenant / withUser / withPublic transaction helpers
src/domain/**         pure logic: state machines, pricing, permissions (unit-tested, no I/O)
db/migrations/*.sql   forward-only, checksummed migrations
```

## Tenant isolation (defence in depth)
1. **Service layer** – each call receives an `Actor {orgId, userId, role}` resolved from the session, checks the permission and filters by `org_id`.
2. **Database** – every tenant table has `ENABLE` + `FORCE ROW LEVEL SECURITY` with `org_id = app_org_id()`. `withTenant` sets `app.org_id` with `set_config(..., true)` (transaction-local), so pooled connections never carry another tenant's context.
3. **Roles** – the app connects as `rentora_app` (no BYPASSRLS, not the table owner). Migrations run as `rentora_owner`.
4. **Public data** – only `is_published` listings and the public identity of their organisation are visible without a tenant. Availability is exposed through `public_available_units()` (security definer) which returns a **count only**.

Tests: `tests/integration/tenancy.test.ts` verifies isolation via services and via raw SQL, including writes with a foreign `org_id`.

## Inventory model
`listings` (what is offered, priced, optionally published) → `units` (physical items with inventory code, serial, QR token, operational status) → `allocations` (unit × time range). Five identical hammers = 1 listing + 5 units.

## Availability and double-booking prevention
`allocations.blocked` = rental period + listing buffer. Constraint:
```sql
exclude using gist (unit_id with =, blocked with &&) where (active)
```
Booking flow (`createReservation`): lock the listing's units `FOR UPDATE` (deterministic order) → select units without overlapping active allocations → insert. The constraint is the final guarantee; violations map to `reservation.conflict`. Maintenance blocks use the same table, so they participate in the same guarantee. Rescheduling and unit reassignment are validated the same way.

## State machines
`src/domain/reservation.ts` and `src/domain/unit.ts`. Reservation, unit (physical) and (future) financial state are tracked separately. Reservation transitions drive unit status where physically meaningful (active → rented, inspection → inspection, completed → available).

## Monetization hooks
- `reservations.source` records acquisition channel; only `marketplace` is commissionable (`isCommissionable`). Staff cannot create `marketplace` bookings manually.
- `subscription_plans` (limits + features JSON) is admin-editable data; unit limits are enforced in `addUnits`.

## Time
All instants are `timestamptz`. Business wall-clock is Europe/Ljubljana (`src/lib/datetime.ts`, DST-safe conversion of `datetime-local` input).

## Motion
GSAP is used for four purposeful moments: dashboard entry sequence and chart reveal, QR passport reveal after scanning, calendar bar entry + conflict feedback, and the marketplace hero. All respect `prefers-reduced-motion` and are cleaned up with `gsap.context().revert()`.
