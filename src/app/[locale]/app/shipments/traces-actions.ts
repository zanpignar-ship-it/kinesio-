'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { getShipment } from '@/lib/shipments/queries';
import { createServerSupabase } from '@/lib/supabase/server';
import { getDdsByInternalReference, submitDds, withdrawDds } from '@/lib/traces/client';
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

  // Claim the shipment atomically: two clicks, tabs or owners cannot send two statements.
  const supabase = await createServerSupabase();
  const { data: claimed } = await supabase
    .from('shipments')
    .update({ traces_status: 'SENDING', traces_message: null })
    .eq('organization_id', m.organization.id)
    .eq('id', id)
    .or('traces_status.is.null,traces_status.in.(REJECTED,WITHDRAWN,CANCELLED,FAILED)')
    .select('id');
  if (!claimed?.length) return { error: 'traces.errors.alreadySubmitted' };

  type TracesColumns = Partial<Record<'traces_uuid' | 'traces_environment' | 'traces_status' | 'traces_submitted_at' | 'traces_checked_at' | 'traces_message', string | null>>;
  const save = async (columns: TracesColumns) => {
    const { error } = await supabase.from('shipments').update(columns).eq('organization_id', m.organization.id).eq('id', id);
    return !error;
  };
  const accepted = async (uuid: string) => {
    const now = new Date().toISOString();
    return save({ traces_uuid: uuid, traces_environment: access.environment, traces_status: 'SUBMITTED', traces_submitted_at: now, traces_checked_at: now, traces_message: null });
  };

  const r = await submitDds(access.environment, access.creds, input);
  if (r.ok) {
    revalidatePath(`/${locale}/app/shipments/${id}`);
    return (await accepted(r.value)) ? { result: 'submitted' } : { error: 'traces.errors.storeFailed', detail: r.value };
  }
  // The answer was lost (timeout, network): find out whether the statement arrived before allowing a new one.
  if (r.fault.code === 'NETWORK' || r.fault.code.startsWith('HTTP_5')) {
    const found = await getDdsByInternalReference(access.environment, access.creds, input.internalRef);
    const match = found.ok ? found.value.find((o) => o.status !== 'WITHDRAWN' && o.status !== 'CANCELLED' && o.status !== 'REJECTED') : undefined;
    if (match) {
      revalidatePath(`/${locale}/app/shipments/${id}`);
      return (await accepted(match.uuid)) ? { result: 'submitted' } : { error: 'traces.errors.storeFailed', detail: match.uuid };
    }
    if (!found.ok) {
      // Unknown outcome: keep the shipment blocked as SENDING so nobody submits twice; the owner checks in TRACES.
      await save({ traces_message: 'UNKNOWN: ' + (r.fault.message || r.fault.code) });
      revalidatePath(`/${locale}/app/shipments/${id}`);
      return { error: 'traces.errors.unknownOutcome', detail: r.fault.message || r.fault.code };
    }
  }
  await save({ traces_status: 'FAILED', traces_message: (r.fault.message || r.fault.code).slice(0, 2000) });
  revalidatePath(`/${locale}/app/shipments/${id}`);
  return { error: 'traces.errors.rejected', detail: r.fault.message || r.fault.code };
}

/** Withdraw a statement within the 72-hour window (TRACES refuses later or for grouped statements). */
export async function withdrawFromTraces(_prev: TracesSubmitState, formData: FormData): Promise<TracesSubmitState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const id = String(formData.get('id') ?? '');
  const m = await context();
  if (!m || !UUID.test(id)) return { error: 'traces.errors.unknown' };
  if (m.role !== 'owner') return { error: 'settings.errors.ownerOnly' };
  const access = await tracesCredentials(m.organization.id);
  if (!access) return { error: 'traces.errors.notConfigured' };
  const supabase = await createServerSupabase();
  const { data: s } = await supabase.from('shipments').select('status, traces_uuid, traces_environment').eq('organization_id', m.organization.id).eq('id', id).maybeSingle();
  if (!s?.traces_uuid || s.traces_environment !== access.environment) return { error: 'traces.errors.unknown' };
  const r = await withdrawDds(access.environment, access.creds, s.traces_uuid);
  if (!r.ok) return { error: 'traces.errors.withdrawFailed', detail: r.fault.message || r.fault.code };
  const update: { traces_status: string; traces_checked_at: string; status?: 'rejected' } = { traces_status: r.value || 'WITHDRAWN', traces_checked_at: new Date().toISOString() };
  if (access.environment === 'production' && s.status === 'submitted') update.status = 'rejected';
  await supabase.from('shipments').update(update).eq('organization_id', m.organization.id).eq('id', id);
  revalidatePath(`/${locale}/app/shipments/${id}`);
  return { result: 'updated' };
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
