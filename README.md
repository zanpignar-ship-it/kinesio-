# RENTORA

Operating infrastructure for equipment rental businesses: **RENTORA Business** (inventory of physical units, reservations without double bookings, calendar, CRM, QR equipment passports) plus a public **marketplace** fed automatically by the providers' availability.

Primary language: Slovenian. Status and gaps: see [`docs/PROGRESS.md`](docs/PROGRESS.md) and [`docs/GAP_ANALYSIS.md`](docs/GAP_ANALYSIS.md).

## Requirements
Node 20+, pnpm 10, PostgreSQL 15+ (with `btree_gist`, `citext`, `pgcrypto`).

## Setup
```bash
pnpm install
cp .env.example .env.local          # adjust credentials if needed
pnpm db:setup                       # local only: creates roles rentora_owner/rentora_app and databases (needs superuser)
pnpm db:migrate
pnpm db:seed                        # optional demo organization (clearly labelled demo data)
pnpm dev                            # http://localhost:3000
```
Demo login after seeding: `demo@rentora.test` / `demo-geslo-2026`.

## Tests
```bash
pnpm typecheck
pnpm test         # unit + integration (resets the rentora_test database)
pnpm test:e2e     # Playwright; starts/reuses the dev server, requires seeded demo data for the mobile test
```

## Deployment (outline)
- Managed PostgreSQL (e.g. Supabase, Neon): create an owner role for migrations and an app role **without BYPASSRLS**; set `DATABASE_URL` (app) and `DATABASE_OWNER_URL` (migrations only, never exposed to the runtime).
- Run `pnpm db:migrate` in the release step, then deploy the Next.js app (Vercel or any Node host). Set `APP_URL` to the public origin (used in QR codes).
- Before scaling horizontally replace the in-memory rate limiter (`src/server/rate-limit.ts`).

Docs: [architecture](docs/ARCHITECTURE.md) · [database](docs/DATABASE.md) · [backlog](docs/BACKLOG.md) · [production checklist](docs/PRODUCTION_CHECKLIST.md) · [changelog](CHANGELOG.md)
