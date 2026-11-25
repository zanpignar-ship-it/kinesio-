import { randomUUID } from "node:crypto";
import { registerUser } from "@/server/services/identity";
import { createOrganization } from "@/server/services/organizations";
import { createListing, addUnits, listCategories, generateCodes } from "@/server/services/inventory";
import { createCustomer } from "@/server/services/customers";
import type { Actor } from "@/server/services/actor";
import type { Role } from "@/domain/permissions";
import { withPublic } from "@/server/db";

export async function makeOrg(name = "Test Najem", plan: "basic" | "pro" = "pro") {
  const user = await registerUser({ fullName: "Owner " + name, email: `${randomUUID()}@test.rentora.local`, password: "correct-horse-battery" });
  const org = await createOrganization(user.id, { name, planCode: plan });
  const owner: Actor = { orgId: org.id, userId: user.id, role: "owner" };
  return { org, user, owner };
}

export async function addMember(orgId: string, role: Role): Promise<Actor> {
  const u = await registerUser({ fullName: `Member ${role}`, email: `${randomUUID()}@test.rentora.local`, password: "correct-horse-battery" });
  await withPublic((tx) => tx.query("insert into org_members (org_id, user_id, role) values ($1,$2,$3)", [orgId, u.id, role]));
  return { orgId, userId: u.id, role };
}

export async function makeListing(actor: Actor, opts: { units?: number; buffer?: number; title?: string } = {}) {
  const [cat] = await listCategories();
  const listing = await createListing(actor, {
    title: opts.title ?? "Rušilno kladivo Makita HM1812",
    categoryId: cat.id,
    priceDayCents: 3500,
    priceWeekCents: 17500,
    depositCents: 20000,
    bufferMinutes: opts.buffer ?? 0,
  });
  const codes = generateCodes(`T${listing.id.slice(0, 4)}`, 1, opts.units ?? 1);
  const units = await addUnits(actor, listing.id, codes.map((internalCode) => ({ internalCode })));
  return { listing, units };
}

export function makeCustomer(actor: Actor, name = "Janez Novak") {
  return createCustomer(actor, { name, email: `${randomUUID()}@example.com` });
}

export const d = (s: string) => new Date(s);
