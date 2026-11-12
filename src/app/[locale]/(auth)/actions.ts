'use server';

import type { AuthError } from '@supabase/supabase-js';
import { redirect } from '@/i18n/navigation';
import { safeNext } from '@/lib/auth/redirect';
import { signInSchema, signUpSchema } from '@/lib/auth/schemas';
import { createServerSupabase } from '@/lib/supabase/server';

export type FormState = { error?: string; fields?: { email?: string } };

/** Supabase error → translation key. */
function authErrorKey(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'auth.errors.invalidCredentials';
    case 'user_already_exists':
    case 'email_exists':
      return 'auth.errors.userExists';
    case 'email_not_confirmed':
      return 'auth.errors.emailNotConfirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'auth.errors.rateLimited';
    case 'weak_password':
      return 'auth.errors.passwordTooShort';
    default:
      return 'auth.errors.unknown';
  }
}

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
};

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = str(formData, 'locale');
  const parsed = signInSchema.safeParse({ email: str(formData, 'email'), password: str(formData, 'password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: { email: str(formData, 'email') } };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorKey(error), fields: { email: parsed.data.email } };
  redirect({ href: safeNext(str(formData, 'next')), locale });
  return {};
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = str(formData, 'locale');
  const parsed = signUpSchema.safeParse({ email: str(formData, 'email'), password: str(formData, 'password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: { email: str(formData, 'email') } };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: authErrorKey(error), fields: { email: parsed.data.email } };
  // With "Confirm email" switched off (development) Supabase returns a session right away.
  if (!data.session) return { error: 'auth.errors.emailNotConfirmed', fields: { email: parsed.data.email } };
  const next = str(formData, 'next');
  redirect({ href: next ? safeNext(next, '/onboarding') : '/onboarding', locale });
  return {};
}

export async function signOut(formData: FormData): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect({ href: '/login', locale: str(formData, 'locale') });
}
