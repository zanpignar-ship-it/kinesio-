'use server';

import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { ORG_COOKIE } from '@/lib/auth/pick-organization';
import { acceptErrorKey } from '@/lib/members/schemas';
import { createServerSupabase } from '@/lib/supabase/server';

export type AcceptState = { error?: string };

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: String(formData.get('token') ?? '') });
  if (error || !data) return { error: acceptErrorKey(error?.hint) };
  (await cookies()).set(ORG_COOKIE, data, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect({ href: '/app', locale });
  return {};
}
