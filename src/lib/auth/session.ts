import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from '@/lib/db/database.types';
import { redirect } from '@/i18n/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { ORG_COOKIE, pickOrganization } from './pick-organization';

export type SessionUser = { id: string; email: string | null };
type Org = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name' | 'size' | 'was_under_eutr' | 'country' | 'kind' | 'eori' | 'tax_id'>;
export type Membership = { role: Database['public']['Enums']['member_role']; organization: Org };

/** The signed-in user (JWT verified by getClaims), or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
});

export const getMemberships = cache(async (userId: string): Promise<Membership[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('memberships')
    .select('role, organization:organizations (id, name, size, was_under_eutr, country, kind, eori, tax_id)')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).flatMap((m) => (m.organization ? [{ role: m.role, organization: m.organization }] : []));
});

/** Signed-in user or a redirect to the login page that comes back to `path` (path without locale). */
export async function requireUser(locale: string, path: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect({ href: { pathname: '/login', query: { next: path } }, locale });
  return user as SessionUser;
}

/** The organization the user works in now (cookie `lt_org`), with the role. */
export async function getCurrentMembership(userId: string): Promise<{ current: Membership | null; all: Membership[] }> {
  const all = await getMemberships(userId);
  const chosen = pickOrganization(
    all.map((m) => ({ id: m.organization.id, m })),
    (await cookies()).get(ORG_COOKIE)?.value,
  );
  return { current: chosen?.m ?? null, all };
}
