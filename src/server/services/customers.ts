import { z } from "zod";
import { withTenant } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { assertCan, ctx, type Actor } from "./actor";

const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const customerSchema = z.object({
  kind: z.enum(["individual", "business"]).default("individual"),
  name: z.string().trim().min(1).max(200),
  companyName: opt(200),
  taxId: opt(30),
  email: z.string().trim().toLowerCase().email().max(254).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: opt(40),
  address: opt(300),
  notes: opt(4000),
  discountPercent: z.number().min(0).max(100).default(0),
  marketingConsent: z.boolean().default(false),
});

export type Customer = {
  id: string; kind: "individual" | "business"; name: string; company_name: string | null; tax_id: string | null; email: string | null;
  phone: string | null; address: string | null; notes: string | null; discount_percent: string; marketing_consent: boolean;
  marketing_consent_at: string | null; created_at: string;
};

export async function listCustomers(actor: Actor, opts: { q?: string; limit?: number } = {}) {
  assertCan(actor, "customers.read");
  return withTenant(ctx(actor), (tx) =>
    tx.query<Customer & { reservations: number; last_rental: string | null; lifetime_cents: number }>(
      `select c.*,
              count(r.id)::int as reservations,
              max(r.starts_at) as last_rental,
              coalesce(sum(r.total_cents) filter (where r.status not in ('cancelled','expired','draft','quotation')), 0)::int as lifetime_cents
         from customers c left join reservations r on r.customer_id = c.id
        where c.org_id = $1 and ($2::text is null or c.name ilike '%'||$2||'%' or c.company_name ilike '%'||$2||'%' or c.email ilike '%'||$2||'%' or c.phone ilike '%'||$2||'%')
        group by c.id order by c.name limit $3`,
      [actor.orgId, opts.q?.trim() || null, Math.min(opts.limit ?? 500, 1000)],
    ),
  );
}

export async function getCustomer(actor: Actor, id: string) {
  assertCan(actor, "customers.read");
  return withTenant(ctx(actor), async (tx) => {
    const customer = await tx.maybeOne<Customer>("select * from customers where id = $1 and org_id = $2", [id, actor.orgId]);
    if (!customer) return null;
    const reservations = await tx.query<{ id: string; number: string; status: string; starts_at: string; ends_at: string; total_cents: number; source: string }>(
      "select id, number, status, starts_at, ends_at, total_cents, source from reservations where customer_id = $1 order by starts_at desc limit 100",
      [id],
    );
    return { customer, reservations };
  });
}

export async function createCustomer(actor: Actor, input: z.input<typeof customerSchema>) {
  assertCan(actor, "customers.write");
  const d = customerSchema.parse(input);
  return withTenant(ctx(actor), async (tx) => {
    const c = await tx.one<Customer>(
      `insert into customers (org_id, kind, name, company_name, tax_id, email, phone, address, notes, discount_percent, marketing_consent, marketing_consent_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, case when $11 then now() end) returning *`,
      [actor.orgId, d.kind, d.name, d.companyName, d.taxId, d.email, d.phone, d.address, d.notes, d.discountPercent, d.marketingConsent],
    );
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "customer.created", entityType: "customer", entityId: c.id });
    return c;
  });
}

export async function updateCustomer(actor: Actor, id: string, input: z.input<typeof customerSchema>) {
  assertCan(actor, "customers.write");
  const d = customerSchema.parse(input);
  return withTenant(ctx(actor), async (tx) => {
    const rows = await tx.query<Customer>(
      `update customers set kind=$3, name=$4, company_name=$5, tax_id=$6, email=$7, phone=$8, address=$9, notes=$10, discount_percent=$11,
              marketing_consent_at = case when $12 and not marketing_consent then now() when not $12 then null else marketing_consent_at end,
              marketing_consent=$12
        where id=$1 and org_id=$2 returning *`,
      [id, actor.orgId, d.kind, d.name, d.companyName, d.taxId, d.email, d.phone, d.address, d.notes, d.discountPercent, d.marketingConsent],
    );
    if (!rows[0]) throw new DomainError("common.notFound");
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "customer.updated", entityType: "customer", entityId: id });
    return rows[0];
  });
}
