'use server';

import { redirect } from '@/i18n/navigation';
import { requestOrigin } from '@/lib/http/origin';
import { newPasswordSchema, resetRequestSchema } from '@/lib/auth/schemas';
import { createServerSupabase } from '@/lib/supabase/server';

export type PasswordState = { error?: string; sent?: boolean };

/**
 * Send a password reset e-mail. The answer is the same whether or not the address has an account (no enumeration).
 * Needs a custom SMTP sender in Supabase for real users (the built-in sender only reaches the project team).
 */
export async function requestPasswordReset(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const origin = await requestOrigin();
  if (!origin) return { error: 'auth.errors.unknown' };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/${locale}/auth/callback?next=/update-password`,
  });
  if (error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit') return { error: 'auth.errors.rateLimited' };
  return { sent: true };
}

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const parsed = newPasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === 'same_password' ? 'auth.errors.samePassword' : error.code === 'weak_password' ? 'auth.errors.passwordTooShort' : 'auth.errors.resetExpired' };
  redirect({ href: '/app', locale });
  return {};
}
