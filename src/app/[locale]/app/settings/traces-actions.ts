'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { createServerSupabase } from '@/lib/supabase/server';
import { getDds, testEcho } from '@/lib/traces/client';
import { encryptSecret } from '@/lib/traces/secret';
import { tracesCredentials } from '@/lib/traces/service';

export type TracesFormState = { error?: string; saved?: boolean; ok?: boolean; detail?: string };

const schema = z.object({
  environment: z.enum(['acceptance', 'production'], { message: 'traces.errors.environment' }),
  username: z.string().trim().min(1, 'traces.errors.username').max(200, 'traces.errors.username'),
  clientId: z.string().trim().min(1, 'traces.errors.clientId').max(100, 'traces.errors.clientId'),
  authKey: z.string().trim().max(500, 'traces.errors.authKey'),
});

async function ownerOrg(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const { current } = await getCurrentMembership(user.id);
  return current?.role === 'owner' ? current.organization.id : null;
}

/** Save the TRACES web-service user; an empty key keeps the stored one. The key is stored encrypted only. */
export async function saveTracesCredentials(_prev: TracesFormState, formData: FormData): Promise<TracesFormState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const orgId = await ownerOrg();
  if (!orgId) return { error: 'settings.errors.ownerOnly' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase.from('traces_credentials').select('organization_id, environment').eq('organization_id', orgId).maybeSingle();
  if (!existing && !v.authKey) return { error: 'traces.errors.authKey' };
  // Keys differ per environment: switching needs the key of the new environment.
  if (existing && existing.environment !== v.environment && !v.authKey) return { error: 'traces.errors.envKey' };
  let encrypted: string | undefined;
  try {
    encrypted = v.authKey ? encryptSecret(v.authKey) : undefined;
  } catch {
    return { error: 'traces.errors.serverKey' };
  }
  const row = { organization_id: orgId, environment: v.environment, username: v.username, client_id: v.clientId, ...(encrypted ? { auth_key_enc: encrypted } : {}) };
  const { error } = existing
    ? await supabase.from('traces_credentials').update(row).eq('organization_id', orgId)
    : await supabase.from('traces_credentials').insert({ ...row, auth_key_enc: encrypted! });
  if (error) return { error: 'traces.errors.unknown' };
  revalidatePath(`/${locale}/app/settings`);
  return { saved: true };
}

/** Acceptance: Echo service. Production has no echo – a lookup of an unknown statement proves credentials and network. */
export async function testTracesConnection(): Promise<TracesFormState> {
  const orgId = await ownerOrg();
  if (!orgId) return { error: 'settings.errors.ownerOnly' };
  const access = await tracesCredentials(orgId);
  if (!access) return { error: 'traces.errors.notConfigured' };
  if (access.environment === 'acceptance') {
    const r = await testEcho('acceptance', access.creds);
    return r.ok ? { ok: true, detail: r.value } : { ok: false, detail: r.fault.message || r.fault.code };
  }
  const r = await getDds('production', access.creds, randomUUID());
  if (r.ok || r.fault.code === 'NotFoundException' || /NOT_?FOUND/i.test(r.fault.code + ' ' + r.fault.message)) return { ok: true, detail: 'OK' };
  return { ok: false, detail: r.fault.message || r.fault.code };
}

export async function deleteTracesCredentials(formData: FormData): Promise<void> {
  const orgId = await ownerOrg();
  if (!orgId) return;
  const supabase = await createServerSupabase();
  await supabase.from('traces_credentials').delete().eq('organization_id', orgId);
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/app/settings`);
}
