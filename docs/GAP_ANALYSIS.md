# RENTORA — Phase 0 audit and gap analysis

_Date: 2026-11-25_

## What was inspected

| Source | Result |
|---|---|
| Existing site `najem-strojev.zan-pignar.chatgpt.site` | **Not reachable** from the build environment (network policy returned HTTP 403 at the proxy; DNS not resolvable for the fetch tool). Nothing on it could be verified. |
| Repository `zanpignar-ship-it/kinesio-` | Contained only `README.md` (`# kinesio-`). **No source code, database schema, auth or data** of the existing project. |
| Existing backend / database | Not available. No production data was touched or migrated. |

**Consequence.** The feature inventory in the brief (12 categories, marketplace, comparison,
provider profiles, inquiries, offers, PDF offers, imports, admin, packages) **could not be verified**
and none of its code could be preserved. Everything in this repository is a new implementation.
It is not a reproduction of the old frontend either, because the old frontend was never seen.

To preserve anything from the original project, the owner must provide one of:
1. read access to its source repository (add it to this session or push it to a branch), or
2. an export of its database (schema + data) and uploaded media, or
3. network access to the live site, so that its public pages can at least be inventoried.

The 12 marketplace categories were recreated from the brief's target-market list. Their slugs are
stable keys and their names can be changed in `db/migrations/0002_*` (via a new migration).

## Specification vs. implementation (end of this execution)

Legend: ✅ implemented and tested · 🟡 partial · ⬜ not started · 🔒 blocked on external dependency

### Phase 1 — Business core
| Area | Status | Notes |
|---|---|---|
| Multi-tenant organizations | ✅ | PostgreSQL RLS on every tenant table, `FORCE ROW LEVEL SECURITY`, app role without BYPASSRLS. Tested at service and raw-SQL level. |
| Authentication | 🟡 | Argon2id, opaque session tokens (SHA-256 at rest), httpOnly cookies, rate limiting. **Missing:** MFA for privileged accounts, password reset (needs email), email verification. |
| Roles and permissions | ✅ | 8 roles, 15 permissions, enforced in services; role changes with a last-owner guard. Configurable per-member overrides are ⬜. |
| Business onboarding | 🟡 | Signup, company profile, plan choice, default location, data-driven checklist. **Missing:** KYB (payment provider), opening hours, VAT config UI, CSV/Excel import. |
| Locations | 🟡 | Data model with default location; multi-location UI ⬜. |
| Inventory: listings vs physical units | ✅ | One listing → N units with codes, serials, QR tokens, purchase data. Plan unit limits enforced (Basic = 30). |
| Unit state machine | ✅ | 11 statuses, invalid transitions rejected, full status history. |
| Customer CRM | ✅ | Individuals/businesses, tax ID, discounts, notes, marketing-consent timestamp, lifetime value. Segmentation ⬜. |
| Reservations | ✅ | Multi-item, multi-unit, automatic unit allocation, cheapest day/week/month pricing, customer discount, deposits, 8 acquisition sources. |
| Double-booking prevention | ✅ | `EXCLUDE USING gist` on allocations (incl. buffer time) + row locks. Concurrency test: 12 parallel attempts → exactly 1 succeeds. |
| Reservation state machine | ✅ | Full lifecycle incl. cancelled/expired/overdue/disputed/refunded; unit status follows; cancellation releases units. |
| Maintenance / blocking periods | ✅ | Blocks the calendar; conflicts with rentals rejected. Scheduled maintenance intervals ⬜. |
| Rental calendar | 🟡 | Resource timeline (week / 2 weeks / month), drag-and-drop and keyboard rescheduling validated server-side, reprices automatically. Day view, employee/status filters, drag-to-resize ⬜. |
| Dashboard | ✅ | Today's pickups/returns, overdue, active, booked value (clearly not cash), marketplace vs direct, utilization, unit status, attention list, activity. |
| Audit log | ✅ | Append-only for the app role; shown on reservations and dashboard. |

### Phase 2 — Digital rental operations
| Area | Status |
|---|---|
| QR equipment passport | ✅ Private passport for members; public QR page shows only equipment name and provider contact. Printable labels in 3 sizes. Camera scanning via BarcodeDetector with manual fallback. |
| Pickup / return workflows (photos, condition, signatures) | ⬜ (state transitions exist; guided mobile workflow not yet) |
| Damage documentation, digital agreements, PDF documents | ⬜ |
| Maintenance management (intervals, costs) | 🟡 blocks + statuses only |

### Phase 3–8
| Area | Status |
|---|---|
| Subscription billing, Stripe Connect, deposits, refunds, commissions ledger | 🔒 needs Stripe account + keys; data model for commission attribution exists via `reservation_source` |
| Marketplace search, listing pages, availability | 🟡 read-only public search/detail and availability check (built in this execution); checkout, messaging, reviews ⬜ |
| Admin platform | ⬜ |
| Email / SMS notifications | 🔒 needs a transactional email provider |
| FURS fiscalization | 🔒 needs certificate and legal review — **no fake fiscal confirmations are produced** |
| Legal documents | ⬜ must be drafted and reviewed by a lawyer |
| AI features | ⬜ deliberately deferred until the core is stable |
