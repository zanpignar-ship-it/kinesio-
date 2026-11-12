'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { getShipment } from '@/lib/shipments/queries';
import { createServerSupabase } from '@/lib/supabase/server';
import { submitDds } from '@/lib/traces/client';
import { checkDds } from '@/lib/traces/dds';
import { ddsInputFor, refreshShipmentTraces, tracesCredentials } from '@/lib/traces/service';

export type TracesSubmitState = { error?: string; problems?: string[]; detail?: string; result?: 'submitted' | 'updated' | 'pending' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING = new Set(['SUBMITTED', 'AVAILABLE', 'GROUPED']);

async function context() {
  const user = await getSessionUser();
  if (!user) return null;
  const { current } = await getCurrentMembership(user.id);
  return current ?? null;
}

/** Submit the shipment's due diligence statement to the EUDR Information System (API V4). Owners only. */
export async function submitToTraces(_prev: TracesSubmitState, formData: FormData): Promise<TracesSubmitState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const id = String(formData.get('id') ?? '');
  const m = await context();
  if (!m || !UUID.test(id)) return { error: 'traces.errors.unknown' };
  if (m.role !== 'owner') return { error: 'settings.errors.ownerOnly' };
  const access = await tracesCredentials(m.organization.id);
  if (!access) return { error: 'traces.errors.notConfigured' };
  const data = await getShipment(m.organization.id, id, locale);
  if (!data) return { error: 'traces.errors.unknown' };
  const s = data.shipment;
  if (s.mode !== 'submit_dds') return { error: 'traces.errors.mode' };
  if (s.traces_status && PENDING.has(s.traces_status)) return { error: 'traces.errors.alreadySubmitted' };
  if (data.status !== 'ready' || !data.readiness.ready) return { error: 'ship.errors.notReady' };
  const input = ddsInputFor(data, m.organization, formData.get('confidential') === 'on');
  const problems = checkDds(input);
  if (problems.length) return { error: 'traces.errors.invalid', problems };

  const r = await submitDds(access.environment, access.creds, input);
  const supabase = await createServerSupabase();
  if (!r.ok) {
    await supabase.from('shipments').update({ traces_message: (r.fault.message || r.fault.code).slice(0, 2000) }).eq('organization_id', m.organization.id).eq('id', id);
    revalidatePath(`/${locale}/app/shipments/${id}`);
    return { error: 'traces.errors.rejected', detail: r.fault.message || r.fault.code };
  }
  const now = new Date().toISOString();
  await supabase
    .from('shipments')
    .update({ traces_uuid: r.value, traces_environment: access.environment, traces_status: 'SUBMITTED', traces_submitted_at: now, traces_checked_at: now, traces_message: null })
    .eq('organization_id', m.organization.id)
    .eq('id', id);
  revalidatePath(`/${locale}/app/shipments/${id}`);
  return { result: 'submitted' };
}

/** Ask TRACES for the reference and verification numbers of a submitted statement. */
export async function checkTracesStatus(_prev: TracesSubmitState, formData: FormData): Promise<TracesSubmitState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const id = String(formData.get('id') ?? '');
  const m = await context();
  if (!m || !UUID.test(id)) return { error: 'traces.errors.unknown' };
  if (m.role !== 'owner') return { error: 'settings.errors.ownerOnly' };
  const r = await refreshShipmentTraces(m.organization.id, id);
  revalidatePath(`/${locale}/app/shipments/${id}`);
  if (r === 'error') return { error: 'traces.errors.check' };
  if (r === 'unavailable') return { error: 'traces.errors.notConfigured' };
  return { result: r };
}
