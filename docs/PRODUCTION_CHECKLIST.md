# Production readiness checklist

Nothing below is complete unless ticked with evidence (link to test run, screenshot, ticket).

## Security
- [x] Tenant isolation enforced in DB (RLS) and services — `tests/integration/tenancy.test.ts`
- [x] Passwords hashed with Argon2id; session tokens stored as SHA-256 hashes; httpOnly + SameSite=Lax cookies
- [x] Login/signup rate limiting (single instance)
- [x] Security headers (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy)
- [x] Server Actions validate input with zod; SQL is parameterized everywhere
- [ ] Content-Security-Policy with nonces
- [ ] MFA for owners and platform admins
- [ ] Shared rate-limit store for multi-instance deployments
- [ ] Dependency audit in CI (`pnpm audit`), secret scanning
- [ ] Penetration test incl. cross-tenant attempts on every route
- [ ] Session revocation UI ("sign out other devices")

## Data
- [x] Forward-only checksummed migrations
- [ ] Automated backups / PITR enabled and **restore drill performed**
- [ ] Data retention policy implemented (sessions cleanup job, audit retention)
- [ ] GDPR export & account deletion workflows

## Payments (not enabled)
- [ ] Stripe account verified, Connect platform profile approved
- [ ] Webhook signature verification + idempotent event table
- [ ] Sandbox end-to-end: subscription, marketplace payment, refund, dispute, payout
- [ ] Live keys only after all of the above

## Legal (requires professional review)
- [ ] Terms of service, provider agreement, marketplace rental terms
- [ ] Privacy policy, cookie policy/consent, DPA for providers
- [ ] Cancellation/refund policy
- [ ] FURS fiscalization integration (certificate, test environment) before issuing invoices

## Operations
- [ ] Error monitoring and alerting
- [ ] Transactional email provider with non-production recipient allow-list
- [ ] Uptime monitoring, background job monitoring
- [ ] Core Web Vitals measured on real devices (targets: LCP < 2.5 s, INP < 200 ms, CLS < 0.1)
