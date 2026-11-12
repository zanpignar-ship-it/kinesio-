'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { requestOrigin } from '@/lib/http/origin';
import { INVITATION_DAYS, inviteSchema } from '@/lib/members/schemas';
import { createShareToken } from '@/lib/share/token';
import { createServerSupabase } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownerContext() {
  const user = await getSessionUser();
  if (!user) return null;
  const { current } = await getCurrentMembership(user.id);
  if (!current || current.role !== 'owner') return null;
  return { user, organizationId: current.organization.id, supabase: await createServerSupabase() };
}

export type InviteState = { error?: string; url?: string; email?: string };

/** Create an invitation; the link is shown once (only the token hash is stored). */
export async function createInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const ctx = await ownerContext();
  if (!ctx) return { error: 'settings.errors.ownerOnly' };
  const parsed = inviteSchema.safeParse({ email: formData.get('email'), role: formData.get('role') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const origin = await requestOrigin();
  if (!origin) return { error: 'members.errors.unknown' };
  const { token, hashHex } = createShareToken();
  const { error } = await ctx.supabase.from('invitations').insert({
    organization_id: ctx.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: `\\x${hashHex}`,
    expires_at: new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString(),
  });
  if (error) return { error: 'members.errors.unknown' };
  revalidatePath(`/${locale}/app/settings`);
  return { url: `${origin}/${locale}/invite/${token}`, email: parsed.data.email };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const ctx = await ownerContext();
  if (!ctx || !UUID.test(id)) return;
  await ctx.supabase.from('invitations').delete().eq('organization_id', ctx.organizationId).eq('id', id);
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/app/settings`);
}

export async function setMemberRole(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  const ctx = await ownerContext();
  if (!ctx || !UUID.test(userId) || (role !== 'owner' && role !== 'member')) return;
  // The database keeps at least one owner (trigger), so demoting the last owner simply fails.
  await ctx.supabase.from('memberships').update({ role }).eq('organization_id', ctx.organizationId).eq('user_id', userId);
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/app/settings`);
}

export async function removeMember(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const ctx = await ownerContext();
  if (!ctx || !UUID.test(userId) || userId === ctx.user.id) return;
  await ctx.supabase.from('memberships').delete().eq('organization_id', ctx.organizationId).eq('user_id', userId);
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/app/settings`);
}
