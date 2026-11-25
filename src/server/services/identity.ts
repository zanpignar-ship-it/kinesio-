import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { withPublic, withUser, isUniqueViolation } from "../db";
import { DomainError } from "../errors";
import type { Role } from "@/domain/permissions";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export type SessionUser = { id: string; email: string; fullName: string; locale: string; isPlatformAdmin: boolean };
export type Membership = { id: string; name: string; slug: string; role: Role; plan_code: string };

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

// Dummy hash so failed lookups take the same time as real verifications.
let dummyHash: Promise<string> | null = null;

export async function registerUser(input: z.infer<typeof signupSchema>): Promise<SessionUser> {
  const data = signupSchema.parse(input);
  const passwordHash = await hash(data.password);
  try {
    return await withPublic(async (tx) => {
      const u = await tx.one<{ id: string; email: string; full_name: string; locale: string; is_platform_admin: boolean }>(
        "insert into users (email, password_hash, full_name) values ($1,$2,$3) returning id, email, full_name, locale, is_platform_admin",
        [data.email, passwordHash, data.fullName],
      );
      return { id: u.id, email: u.email, fullName: u.full_name, locale: u.locale, isPlatformAdmin: u.is_platform_admin };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("auth.emailTaken");
    throw e;
  }
}

export async function authenticate(input: z.infer<typeof loginSchema>): Promise<SessionUser> {
  const data = loginSchema.parse(input);
  const row = await withPublic((tx) =>
    tx.maybeOne<{ id: string; email: string; full_name: string; locale: string; is_platform_admin: boolean; password_hash: string }>(
      "select id, email, full_name, locale, is_platform_admin, password_hash from users where email = $1",
      [data.email],
    ),
  );
  if (!row) {
    dummyHash ??= hash("timing-equalizer-not-a-password");
    await verify(await dummyHash, data.password).catch(() => false);
    throw new DomainError("auth.invalidCredentials");
  }
  const ok = await verify(row.password_hash, data.password).catch(() => false);
  if (!ok) throw new DomainError("auth.invalidCredentials");
  return { id: row.id, email: row.email, fullName: row.full_name, locale: row.locale, isPlatformAdmin: row.is_platform_admin };
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const orgs = await listMemberships(userId);
  await withPublic((tx) =>
    tx.query("insert into sessions (token_hash, user_id, active_org_id, ip, user_agent, expires_at) values ($1,$2,$3,$4,$5,$6)", [
      hashToken(token),
      userId,
      orgs[0]?.id ?? null,
      meta.ip ?? null,
      meta.userAgent?.slice(0, 400) ?? null,
      expiresAt,
    ]),
  );
  return { token, expiresAt };
}

export async function resolveSession(token: string) {
  return withPublic(async (tx) => {
    const row = await tx.maybeOne<{
      user_id: string; active_org_id: string | null; email: string; full_name: string; locale: string; is_platform_admin: boolean;
    }>(
      `select s.user_id, s.active_org_id, u.email, u.full_name, u.locale, u.is_platform_admin
         from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [hashToken(token)],
    );
    if (!row) return null;
    const user: SessionUser = { id: row.user_id, email: row.email, fullName: row.full_name, locale: row.locale, isPlatformAdmin: row.is_platform_admin };
    return { user, activeOrgId: row.active_org_id };
  });
}

export async function setActiveOrg(token: string, orgId: string, userId: string) {
  const orgs = await listMemberships(userId);
  if (!orgs.some((o) => o.id === orgId)) throw new DomainError("auth.forbidden");
  await withPublic((tx) => tx.query("update sessions set active_org_id = $1 where token_hash = $2 and user_id = $3", [orgId, hashToken(token), userId]));
}

export async function destroySession(token: string) {
  await withPublic((tx) => tx.query("delete from sessions where token_hash = $1", [hashToken(token)]));
}

export async function listMemberships(userId: string): Promise<Membership[]> {
  return withUser(userId, (tx) => tx.query<Membership>("select * from user_organizations($1)", [userId]));
}
