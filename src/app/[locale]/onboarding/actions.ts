'use server';

import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { ORG_COOKIE } from '@/lib/auth/pick-organization';
import { organizationSchema } from '@/lib/auth/schemas';
import { createServerSupabase } from '@/lib/supabase/server';

export type OrgFormState = { error?: string; saved?: boolean; values?: Record<string, string> };

export async function createOrganization(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const locale = raw.locale ?? 'sl';
  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: raw };
  const o = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: o.name,
      country: o.country,
      kind: o.kind,
      size: o.size,
      tax_id: o.taxId,
      registration_no: o.registrationNo,
      address: o.address,
      eori: o.eori,
      was_under_eutr: o.wasUnderEutr,
    })
    .select('id')
    .single();
  if (error || !data) return { error: 'org.errors.unknown', values: raw };
  (await cookies()).set(ORG_COOKIE, data.id, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect({ href: '/app', locale });
  return {};
}
