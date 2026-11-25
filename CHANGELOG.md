# Changelog

## 0.1.0 — 2026-11-25
First implementation (the original project's source was not available; see docs/GAP_ANALYSIS.md).

### Added
- Multi-tenant PostgreSQL schema with row-level security and audit log.
- Accounts (Argon2id), sessions, onboarding with plan selection and computed setup checklist.
- Roles & permissions (8 roles), member management with last-owner protection.
- Inventory: listings with day/week/month pricing, deposits, buffer time; physical units with inventory codes, serials, QR tokens and a validated status machine.
- Customers (CRM) with discounts and marketing-consent timestamps.
- Reservations: multi-item, automatic unit allocation, database-enforced double-booking prevention, lifecycle state machine, rescheduling, unit reassignment, maintenance/blocking periods.
- Business dashboard, resource timeline calendar with drag & drop, QR passports, printable labels, camera scanning.
- Public marketing site, pricing, marketplace search and listing pages with live availability counts.
- Unit, integration and Playwright end-to-end tests.
