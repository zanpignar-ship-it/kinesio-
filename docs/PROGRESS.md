# Implementation progress

_Last updated: 2026-11-25 (end of execution 1)_

## Verified in this execution
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `next lint` | pass, 0 warnings |
| `pnpm test` (Vitest, real PostgreSQL 16) | **27 / 27 pass**: domain rules, RLS isolation (service + raw SQL), concurrency (12 parallel bookings → 1 succeeds), buffers, maintenance blocks, lifecycle, rescheduling, plan limits, members, public marketplace exposure |
| `pnpm build` | pass |
| `pnpm test:e2e` against `next start` | **4 / 4 pass**: signup → onboarding → listing with 3 units → customer → reservation (live availability, price) → server rejects overlap → hand-over → inspection → completion → calendar; cross-tenant URL returns 404; unauthenticated redirect + login error; mobile bottom nav, scan by code, 44 px touch targets, no horizontal overflow, reduced motion |
| Manual visual review | dashboard, calendar, passport, reservation builder (1440 px); dashboard (iPhone 13); public homepage, pricing, business, equipment (1440 / 390 px) |

Core Web Vitals were **not measured** (no real-device or field data yet).

## Completed and tested
Multi-tenant core with RLS · auth & sessions · onboarding · roles & member management · inventory (listings + physical units) · unit status machine & history · CRM · reservations with DB-enforced double-booking prevention · reservation lifecycle · rescheduling & unit reassignment (calendar drag & drop, keyboard) · maintenance/blocking · dashboard · QR passports (private + public card) · printable labels · scan by camera/code · public marketplace search, listing detail and availability API · pricing & business landing pages · sitemap/robots/structured data.

## Partially completed
- Calendar: no day view, no filters, no drag-to-resize.
- Onboarding: no CSV/Excel import, opening hours or VAT settings UI.
- Camera scanning depends on the browser's BarcodeDetector (Chrome/Android; recent Safari). Fallback: phone camera opens the QR URL, or typed code.
- English localisation covers navigation and key labels only; German/Croatian fall back to Slovenian.

## Missing (see BACKLOG.md)
Pickup/return workflows with photos and acknowledgements · documents & PDFs · maintenance schedules & costs · payments, subscriptions, commissions, deposits · marketplace checkout, messaging, reviews, customer portal · admin platform · notifications · MFA, password reset · GDPR export/deletion · AI features.

## Known issues
- An overdue rental does not yet block bookings made after its planned end (needs the overdue background job, backlog #1). The dashboard flags overdue rentals.
- In-memory rate limiter: correct for one instance only.
- The seed script is not transactional; on failure, delete the demo org before re-running.
- Hero card on the homepage is a labelled sample ("Primer oglasa"), not live data.

## External integrations requiring credentials
Stripe (Billing + Connect) · transactional email (e.g. Postmark/Resend) · SMS provider · object storage for photos/documents (e.g. Supabase Storage / S3) · FURS fiscal certificate · error monitoring.

## Decisions requiring owner approval
1. Source of the original project (repo, DB export or site access) if anything should be preserved or migrated.
2. Final names of the 12 categories.
3. Hosting: Supabase vs Neon vs other Postgres; Vercel for the app.
4. Commission model default (flat 5 % vs 10/5/2 %) and whether Pro/Enterprise get "unlimited" units (DB currently caps at 2,000 / 20,000).
5. Legal: terms, privacy policy, provider agreement, cancellation policy, e-signature level for agreements.
