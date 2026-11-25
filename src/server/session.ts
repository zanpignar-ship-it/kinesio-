import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, listMemberships, SESSION_TTL_MS } from "./services/identity";
import { can, isRole, type Permission } from "@/domain/permissions";
import type { Actor } from "./services/actor";

export const SESSION_COOKIE = "rentora_session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export const getSession = cache(async () => {
  const token = await sessionToken();
  if (!token) return null;
  const s = await resolveSession(token);
  if (!s) return null;
  const memberships = await listMemberships(s.user.id);
  const active = memberships.find((m) => m.id === s.activeOrgId) ?? memberships[0] ?? null;
  return { ...s, memberships, active };
});

/** Resolves the acting member or redirects. Use in every Business page and action. */
export async function requireActor(permission?: Permission): Promise<Actor & { orgName: string; userName: string; plan: string }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.active) redirect("/app/onboarding");
  const role = s.active.role;
  if (!isRole(role)) redirect("/login");
  if (permission && !can(role, permission)) redirect("/app?denied=1");
  return { orgId: s.active.id, userId: s.user.id, role, orgName: s.active.name, userName: s.user.fullName, plan: s.active.plan_code };
}

export async function clientMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: h.get("user-agent") };
}
