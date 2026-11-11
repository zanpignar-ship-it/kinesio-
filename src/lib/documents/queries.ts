import 'server-only';
import type { Database } from '@/lib/db/database.types';
import { createServerSupabase } from '@/lib/supabase/server';
import { documentExpiry, isoDateIn, type DocumentExpiry } from './expiry';

type DocumentType = Database['public']['Enums']['document_type'];
export type DocumentRow = Pick<Database['public']['Tables']['documents']['Row'], 'id' | 'title' | 'type' | 'valid_from' | 'valid_to' | 'created_at'> & {
  expiry: DocumentExpiry;
};

const TYPES = ['felling_permit', 'decision', 'delivery_note', 'certificate_fsc', 'certificate_pefc', 'other'] as const;
const EXPIRIES = ['none', 'valid', 'expiring', 'expired'] as const;

export function parseDocumentFilters(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const type = one('type');
  const expiry = one('expiry');
  return {
    type: (TYPES as readonly string[]).includes(type ?? '') ? (type as DocumentType) : undefined,
    expiry: (EXPIRIES as readonly string[]).includes(expiry ?? '') ? (expiry as DocumentExpiry) : undefined,
  };
}

export async function listDocuments(organizationId: string, f: ReturnType<typeof parseDocumentFilters>): Promise<DocumentRow[]> {
  const supabase = await createServerSupabase();
  let q = supabase.from('documents').select('id, title, type, valid_from, valid_to, created_at').eq('organization_id', organizationId);
  if (f.type) q = q.eq('type', f.type);
  const { data, error } = await q.order('valid_to', { ascending: true, nullsFirst: false }).order('title').limit(1000);
  if (error) throw error;
  const rows = (data ?? []).map((d) => ({ ...d, expiry: documentExpiry(d.valid_to) }));
  return f.expiry ? rows.filter((r) => r.expiry === f.expiry) : rows;
}

export async function getDocument(organizationId: string, id: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('documents')
    .select('*, plot_documents (plot:plots (id, label))')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const plots = (data.plot_documents ?? []).flatMap((pd) => (pd.plot ? [pd.plot] : []));
  const { data: signed } = await supabase.storage.from('documents').createSignedUrl(data.file_path, 600);
  return { ...data, plots, signedUrl: signed?.signedUrl ?? null, expiry: documentExpiry(data.valid_to) };
}

/** Plots for the picker (label only), newest organizations rarely exceed a few thousand. */
export async function plotsForPicker(organizationId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('plots').select('id, label').eq('organization_id', organizationId).is('archived_at', null).order('label').limit(2000);
  return data ?? [];
}

export async function documentsForPlot(organizationId: string, plotId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('plot_documents')
    .select('document:documents (id, title, type, valid_to)')
    .eq('organization_id', organizationId)
    .eq('plot_id', plotId);
  return (data ?? []).flatMap((r) => (r.document ? [{ ...r.document, expiry: documentExpiry(r.document.valid_to) }] : []));
}

/** Documents whose end date is today or within the next 30 days. */
export async function expiringDocuments(organizationId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('documents')
    .select('id, title, valid_to')
    .eq('organization_id', organizationId)
    .gte('valid_to', isoDateIn(0))
    .lte('valid_to', isoDateIn(30))
    .order('valid_to')
    .limit(20);
  return data ?? [];
}
