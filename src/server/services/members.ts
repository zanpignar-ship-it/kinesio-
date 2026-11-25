import { z } from "zod";
import { withTenant } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { assertCan, ctx, type Actor } from "./actor";
import { ROLES, type Role } from "@/domain/permissions";

export async function listMembers(actor: Actor) {
  assertCan(actor, "reservations.read");
  return withTenant(ctx(actor), (tx) =>
    tx.query<{ user_id: string; full_name: string; email: string; role: Role; status: string; created_at: Date }>(
      `select m.user_id, u.full_name, u.email, m.role, m.status, m.created_at
         from org_members m join users u on u.id = m.user_id where m.org_id = $1 order by m.created_at`, [actor.orgId]));
}

const roleSchema = z.enum(ROLES);

/** Changes a member's role. The last active owner can never be demoted. */
export async function changeMemberRole(actor: Actor, userId: string, role: z.input<typeof roleSchema>) {
  assertCan(actor, "members.manage");
  const r = roleSchema.parse(role);
  if (r === "owner" && actor.role !== "owner") throw new DomainError("auth.forbidden");
  return withTenant(ctx(actor), async (tx) => {
    await tx.query("select 1 from organizations where id = $1 for update", [actor.orgId]);
    const m = await tx.maybeOne<{ role: Role }>("select role from org_members where org_id = $1 and user_id = $2", [actor.orgId, userId]);
    if (!m) throw new DomainError("common.notFound");
    if (m.role === "owner" && actor.role !== "owner") throw new DomainError("auth.forbidden");
    if (m.role === "owner" && r !== "owner") {
      const { n } = await tx.one<{ n: number }>("select count(*)::int as n from org_members where org_id = $1 and role = 'owner' and status = 'active'", [actor.orgId]);
      if (n <= 1) throw new DomainError("members.lastOwner");
    }
    await tx.query("update org_members set role = $3 where org_id = $1 and user_id = $2", [actor.orgId, userId, r]);
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "member.role_changed", entityType: "member", entityId: userId, data: { from: m.role, to: r } });
  });
}

/**
 * Adds an existing RENTORA account to the organization. Email invitations for
 * people without an account require the transactional email integration.
 */
export async function addMemberByEmail(actor: Actor, email: string, role: z.input<typeof roleSchema>) {
  assertCan(actor, "members.manage");
  const r = roleSchema.parse(role);
  if (r === "owner" && actor.role !== "owner") throw new DomainError("auth.forbidden");
  const e = z.string().trim().toLowerCase().email().parse(email);
  return withTenant(ctx(actor), async (tx) => {
    const plan = await tx.one<{ members: number | null }>(
      "select (p.limits->>'members')::int as members from organizations o join subscription_plans p on p.code = o.plan_code where o.id = $1 for update of o", [actor.orgId]);
    const { n } = await tx.one<{ n: number }>("select count(*)::int as n from org_members where org_id = $1", [actor.orgId]);
    if (plan.members != null && n >= plan.members) throw new DomainError("plan.memberLimit", undefined, { limit: plan.members });
    const u = await tx.maybeOne<{ id: string }>("select id from users where email = $1", [e]);
    if (!u) throw new DomainError("members.noAccount");
    const rows = await tx.query("insert into org_members (org_id, user_id, role) values ($1,$2,$3) on conflict do nothing returning user_id", [actor.orgId, u.id, r]);
    if (!rows.length) throw new DomainError("members.already");
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "member.added", entityType: "member", entityId: u.id, data: { role: r } });
  });
}
