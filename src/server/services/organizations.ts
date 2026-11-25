import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenant, isUniqueViolation, type Tx } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { assertCan, ctx, type Actor } from "./actor";

export const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  taxId: z.string().trim().max(30).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  planCode: z.enum(["basic", "pro", "enterprise"]).default("pro"),
});

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "org";
}

export type Organization = {
  id: string; name: string; slug: string; legal_name: string | null; tax_id: string | null; plan_code: string;
  currency: string; timezone: string; trial_ends_at: string | null; onboarding: Record<string, boolean>; status: string;
};

export async function createOrganization(userId: string, input: z.input<typeof createOrgSchema>) {
  const data = createOrgSchema.parse(input);
  const orgId = randomUUID();
  const base = slugify(data.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      return await withTenant({ orgId, userId }, async (tx) => {
        const org = await tx.one<Organization>(
          `insert into organizations (id, name, slug, legal_name, tax_id, phone, plan_code, trial_ends_at)
           values ($1,$2,$3,$4,$5,$6,$7, now() + interval '14 days') returning *`,
          [orgId, data.name, slug, data.legalName || null, data.taxId || null, data.phone || null, data.planCode],
        );
        await tx.query("insert into org_members (org_id, user_id, role) values ($1,$2,'owner')", [orgId, userId]);
        await tx.query(
          "insert into locations (org_id, name, address, city, is_default) values ($1,$2,$3,$4,true)",
          [orgId, data.city ? `${data.city}` : "Glavna lokacija", data.address || null, data.city || null],
        );
        await audit(tx, { orgId, actorUserId: userId, action: "organization.created", entityType: "organization", entityId: orgId, data: { plan: data.planCode } });
        return org;
      });
    } catch (e) {
      if (isUniqueViolation(e, "organizations_slug_key")) continue;
      throw e;
    }
  }
  throw new DomainError("org.slugUnavailable");
}

export async function getOrganization(actor: Actor) {
  return withTenant(ctx(actor), (tx) => tx.one<Organization>("select * from organizations where id = $1", [actor.orgId]));
}

export async function getPlanLimits(tx: Tx, orgId: string) {
  return tx.one<{ code: string; name: string; limits: { units?: number; locations?: number; members?: number }; features: string[] }>(
    "select p.code, p.name, p.limits, p.features from organizations o join subscription_plans p on p.code = o.plan_code where o.id = $1",
    [orgId],
  );
}

export async function listLocations(actor: Actor) {
  return withTenant(ctx(actor), (tx) =>
    tx.query<{ id: string; name: string; city: string | null; is_default: boolean }>(
      "select id, name, city, is_default from locations order by is_default desc, name",
    ),
  );
}

export type OnboardingStep = "profile" | "location" | "inventory" | "customer" | "reservation" | "team";

/** Onboarding checklist computed from real data (not self-reported). */
export async function onboardingStatus(actor: Actor) {
  return withTenant(ctx(actor), async (tx) => {
    const r = await tx.one<{ profile: boolean; inventory: boolean; units: boolean; customer: boolean; reservation: boolean; team: boolean }>(
      `select
         (select tax_id is not null and legal_name is not null from organizations where id = $1) as profile,
         exists (select 1 from listings) as inventory,
         exists (select 1 from units) as units,
         exists (select 1 from customers) as customer,
         exists (select 1 from reservations) as reservation,
         (select count(*) > 1 from org_members where org_id = $1) as team`,
      [actor.orgId],
    );
    return r;
  });
}

export const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  taxId: z.string().trim().max(30).optional().or(z.literal("")),
  registrationNo: z.string().trim().max(30).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  vatPayer: z.boolean().default(true),
});

export async function updateOrganization(actor: Actor, input: z.input<typeof updateOrgSchema>) {
  assertCan(actor, "org.manage");
  const d = updateOrgSchema.parse(input);
  return withTenant(ctx(actor), async (tx) => {
    await tx.query(
      `update organizations set name=$2, legal_name=$3, tax_id=$4, registration_no=$5, phone=$6, email=$7, vat_payer=$8 where id=$1`,
      [actor.orgId, d.name, d.legalName || null, d.taxId || null, d.registrationNo || null, d.phone || null, d.email || null, d.vatPayer],
    );
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "organization.updated", entityType: "organization", entityId: actor.orgId });
  });
}
