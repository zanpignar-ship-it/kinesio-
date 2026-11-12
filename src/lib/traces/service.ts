import 'server-only';
import type { Membership } from '@/lib/auth/session';
import type { getShipment } from '@/lib/shipments/queries';
import { createServerSupabase } from '@/lib/supabase/server';
import { getDds, type TracesEnvironment } from './client';
import type { DdsActivity, DdsInput } from './dds';
import type { DdsOverview } from './parse';
import { decryptSecret } from './secret';
import type { TracesCredentials } from './wsse';

/** Default WebServiceClientId per environment. TODO: preveri vrednosti v razdelku "Web Services Access" profila TRACES. */
export const DEFAULT_CLIENT_ID: Record<TracesEnvironment, string> = { acceptance: 'eudr-test', production: 'eudr-repository' };

/** The documentation asks to wait at least one hour after submitting before asking for the reference number. */
export const CHECK_INTERVAL_MS = 60 * 60_000;

export type TracesSettings = { environment: TracesEnvironment; username: string; clientId: string; updatedAt: string };

/** Stored settings without the key (RLS: owners only – members get null). */
export async function tracesSettings(organizationId: string): Promise<TracesSettings | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('traces_credentials').select('environment, username, client_id, updated_at').eq('organization_id', organizationId).maybeSingle();
  return data ? { environment: data.environment as TracesEnvironment, username: data.username, clientId: data.client_id, updatedAt: data.updated_at } : null;
}

export async function tracesCredentials(organizationId: string): Promise<{ environment: TracesEnvironment; creds: TracesCredentials } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('traces_credentials').select('environment, username, client_id, auth_key_enc').eq('organization_id', organizationId).maybeSingle();
  if (!data) return null;
  try {
    return { environment: data.environment as TracesEnvironment, creds: { username: data.username, clientId: data.client_id, authKey: decryptSecret(data.auth_key_enc) } };
  } catch {
    return null;
  }
}

type ShipmentData = NonNullable<Awaited<ReturnType<typeof getShipment>>>;

/** The due diligence statement for one shipment, from the same data as the GeoJSON download and the DDS summary. */
export function ddsInputFor(data: ShipmentData, org: Membership['organization'], geoLocationConfidential: boolean): DdsInput {
  const s = data.shipment;
  return {
    internalRef: s.internal_ref,
    activity: s.activity.toUpperCase() as DdsActivity,
    countryOfActivity: org.country,
    geoLocationConfidential,
    commodities: data.items.map((i) => ({
      description: i.tradeName ? `${i.product} – ${i.tradeName}` : i.product,
      hsCode: i.hsCode,
      netMassKg: i.netMassKg,
      volumeM3: i.volumeM3,
      pieces: i.pieces,
      scientificName: i.scientificName,
      commonName: i.commonName,
      plotIds: i.plotIds,
    })),
    plots: data.exportPlots,
  };
}

/** Columns to store after asking TRACES about a submitted statement. */
export type TracesShipmentUpdate = {
  traces_status: string;
  traces_checked_at: string;
  traces_message: string | null;
  status?: 'submitted' | 'rejected';
  dds_reference_no?: string;
  dds_verification_no?: string | null;
  submitted_at?: string;
};

/**
 * Columns to store after asking TRACES. Only production statements change the shipment itself: numbers from the
 * acceptance (test) environment are shown in the TRACES panel but never become the shipment's DDS numbers.
 */
export function shipmentUpdateFromOverview(o: DdsOverview, currentStatus: string, environment: string): TracesShipmentUpdate {
  const now = new Date().toISOString();
  const numbers = o.referenceNumber ? `${o.referenceNumber}${o.verificationNumber ? ` / ${o.verificationNumber}` : ''}` : null;
  const info = o.rejectionReason ?? o.communication ?? o.referenceNumberInfo;
  const base: TracesShipmentUpdate = { traces_status: o.status, traces_checked_at: now, traces_message: [numbers, info].filter(Boolean).join(' · ') || null };
  if (environment !== 'production') return base;
  if (o.status === 'AVAILABLE' && o.referenceNumber && currentStatus === 'ready') {
    return { ...base, status: 'submitted', dds_reference_no: o.referenceNumber, dds_verification_no: o.verificationNumber, submitted_at: now };
  }
  if ((o.status === 'REJECTED' || o.status === 'WITHDRAWN' || o.status === 'CANCELLED') && currentStatus !== 'rejected') return { ...base, status: 'rejected' };
  return base;
}

/** TRACES states in which the shipment's content must not change (it is, or is about to be, a filed statement). */
export const TRACES_LOCKED = new Set(['SENDING', 'SUBMITTED', 'AVAILABLE', 'GROUPED']);

/** A pending statement whose last check is older than the recommended interval. */
export function tracesCheckDue(s: { traces_status: string | null; traces_checked_at: string | null }, now: number = Date.now()): boolean {
  return s.traces_status === 'SUBMITTED' && (!s.traces_checked_at || now - new Date(s.traces_checked_at).getTime() > CHECK_INTERVAL_MS);
}

/** Ask TRACES for the state of a pending statement (owners only – the credentials are needed). */
export async function refreshShipmentTraces(organizationId: string, shipmentId: string): Promise<'updated' | 'pending' | 'unavailable' | 'error'> {
  const supabase = await createServerSupabase();
  const { data: s } = await supabase.from('shipments').select('status, traces_uuid, traces_environment').eq('organization_id', organizationId).eq('id', shipmentId).maybeSingle();
  if (!s?.traces_uuid || !s.traces_environment) return 'unavailable';
  const access = await tracesCredentials(organizationId);
  if (!access || access.environment !== s.traces_environment) return 'unavailable';
  const r = await getDds(access.environment, access.creds, s.traces_uuid);
  const checked = { traces_checked_at: new Date().toISOString() };
  if (!r.ok || !r.value) {
    // Remember the attempt in every case, so page views do not ask TRACES again before the interval.
    await supabase.from('shipments').update(r.ok ? checked : { ...checked, traces_message: (r.fault.message || r.fault.code).slice(0, 2000) }).eq('organization_id', organizationId).eq('id', shipmentId);
    return r.ok ? 'pending' : 'error';
  }
  const { error } = await supabase.from('shipments').update(shipmentUpdateFromOverview(r.value, s.status, s.traces_environment)).eq('organization_id', organizationId).eq('id', shipmentId);
  if (error) {
    await supabase.from('shipments').update(checked).eq('organization_id', organizationId).eq('id', shipmentId);
    return 'error';
  }
  return r.value.status === 'SUBMITTED' ? 'pending' : 'updated';
}
