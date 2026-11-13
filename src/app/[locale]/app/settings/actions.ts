'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { ORG_COOKIE } from '@/lib/auth/pick-organization';
import { organizationSchema } from '@/lib/auth/schemas';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { createServerSupabase } from '@/lib/supabase/server';
import type { OrgFormState } from '@/app/[locale]/onboarding/actions';

const formValues = (formData: FormData) =>
  Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

export async function updateOrganization(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const raw = formValues(formData);
  const user = await getSessionUser();
  if (!user) return { error: 'org.errors.unknown', values: raw };
  const { current } = await getCurrentMembership(user.id);
  if (!current || current.role !== 'owner') return { error: 'settings.errors.ownerOnly', values: raw };
  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: raw };
  const o = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('organizations')
    .update({
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
    .eq('id', current.organization.id);
  if (error) return { error: 'org.errors.unknown', values: raw };
  revalidatePath('/', 'layout');
  return { saved: true, values: raw };
}

export type DeleteAccountState = { error?: string; blocked?: string[] };

type DeletionPlan = { blocked: string[]; solo: string[] };

export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const user = await getSessionUser();
  if (!user) return { error: 'settings.errors.unknown' };
  if (String(formData.get('confirm') ?? '').trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return { error: 'settings.errors.confirm' };
  }
  const supabase = await createServerSupabase();
  const dry = await supabase.rpc('delete_my_account', { p_dry_run: true });
  if (dry.error) return { error: 'settings.errors.notAvailable' };
  const plan = dry.data as unknown as DeletionPlan;
  if (plan.blocked.length > 0) return { error: 'settings.errors.transferOwnership', blocked: plan.blocked };

  // Stored files of organizations that disappear with the account (the DB function cannot reach Storage).
  for (const orgId of plan.solo) {
    for (const [bucket, table] of [['documents', 'documents'], ['plot-imports', 'plot_imports']] as const) {
      const paths: string[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from(table).select('id, file_path').eq('organization_id', orgId).order('id').range(from, from + 999);
        paths.push(...(data ?? []).map((r) => r.file_path).filter(Boolean));
        if (!data || data.length < 1000) break;
      }
      for (let i = 0; i < paths.length; i += 100) await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    }
  }
  const done = await supabase.rpc('delete_my_account', { p_dry_run: false });
  if (done.error) return { error: done.error.hint === 'LT_TRANSFER_OWNERSHIP' ? 'settings.errors.transferOwnership' : 'settings.errors.unknown' };
  await supabase.auth.signOut();
  (await cookies()).delete(ORG_COOKIE);
  redirect({ href: '/?deleted=1', locale });
  return {};
}
