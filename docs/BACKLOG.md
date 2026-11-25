# RENTORA implementation backlog

Ordered by business value and dependency. Each item lists its acceptance check.

## Next (Phase 1 completion / Phase 2 start)
1. **Overdue automation** – background job (idempotent, every 15 min) that marks `active` reservations past `ends_at` as `overdue`, extends their allocation while overdue and flags conflicting upcoming bookings. _Check: integration test with a frozen clock._
2. **Pickup workflow (mobile)** – scan → confirm unit → checklist (accessories, hours/mileage, condition, photos) → acknowledgement → `active`. Photos to object storage with signed URLs. _Check: Playwright on iPhone viewport._
3. **Return workflow** – compare condition, new damage, missing accessories, additional charges (documented), unit → `inspection` / `available` / `maintenance`.
4. **Documents** – quotation, rental agreement, pickup/return report PDFs with numbering, branding, version history. Signature levels labelled honestly (simple acknowledgement ≠ QES).
5. **CSV/Excel inventory import** with preview, validation and error report.
6. **Password reset + email verification + TOTP MFA for owners/admins** (needs email provider).
7. **Calendar**: day view, filters (location, status), drag to resize (extend rental), create by drag on empty slot.
8. **Locations & opening hours UI**, pickups outside opening hours warning.
9. **Maintenance schedules** – date/hour intervals, reminders, costs feeding unit profitability.

## Phase 3 – Monetization (blocked on Stripe credentials)
10. Stripe Billing for subscriptions (trial, monthly/annual, upgrades, promo codes); plan limits already enforced.
11. Stripe Connect Express onboarding (KYB), marketplace payments with application fee, webhook ingestion table with signature verification + idempotency keys.
12. Commission ledger (default 5 % or 10/5/2 % decreasing model, configurable, auditable), only for `source = marketplace`.
13. Deposits: authorization holds ≤ 7 days; longer rentals → separate deposit capture & refund workflow.

## Phase 4 – Marketplace
14. Checkout (instant vs request booking), customer accounts and portal.
15. Internal messaging with contact-detail detection before confirmation; contact reveal after confirmation.
16. Verified reviews (only after completed rental), map discovery, comparison, saved equipment.

## Phase 5 – Admin
17. Platform admin app (MRR/ARR/GMV, provider verification, moderation, plan/commission config, sales CRM, system health). Platform-admin access already supported by RLS policies (`app.platform_admin`).

## Engineering
18. Shared rate-limit store (Redis/Upstash) before running more than one instance.
19. Error monitoring (Sentry or Vercel Observability) and structured logging.
20. CI: typecheck, lint, unit+integration tests against Postgres service, Playwright smoke.
21. Point-in-time recovery backups + restore drill.
