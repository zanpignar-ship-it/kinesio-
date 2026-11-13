import 'server-only';
import type { Database } from '@/lib/db/database.types';
import type { PlotStatus } from '@/lib/geo/types';
import { createServerSupabase } from '@/lib/supabase/server';

export const PAGE_SIZE = 50;
const STATUSES: PlotStatus[] = ['valid', 'warning', 'error'];

export type PlotListFilters = { status?: PlotStatus; q?: string; country?: string; supplier?: string; archived: boolean; page: number };
export type PlotListRow = Pick<Database['public']['Tables']['plots']['Row'], 'id' | 'label' | 'country' | 'area_ha' | 'validation_status' | 'updated_at'>;

export function parseFilters(sp: Record<string, string | string[] | undefined>): PlotListFilters {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const status = one('status');
  const page = Number.parseInt(one('page') ?? '1', 10);
  return {
    status: STATUSES.includes(status as PlotStatus) ? (status as PlotStatus) : undefined,
    q: one('q')?.trim().slice(0, 100) || undefined,
    country: /^[A-Z]{2}$/.test(one('country') ?? '') ? one('country') : undefined,
    supplier: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(one('supplier') ?? '') ? one('supplier') : undefined,
    archived: one('archived') === '1',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Suppliers of the organization for pickers and filters. */
export async function supplierOptions(organizationId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('suppliers').select('id, name').eq('organization_id', organizationId).order('name');
  return data ?? [];
}

/** Plots added by suppliers through the portal that the app has not validated yet. */
export async function plotsAwaitingReview(organizationId: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase
    .from('plots')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .not('submitted_via_link', 'is', null)
    .contains('validation_issues', JSON.stringify([{ code: 'SUPPLIER_SUBMITTED' }]));
  return count ?? 0;
}

/** Number of active (not archived) plots per validation status. */
export async function plotStatusCounts(organizationId: string): Promise<Record<PlotStatus, number>> {
  const supabase = await createServerSupabase();
  const results = await Promise.all(
    STATUSES.map((s) =>
      supabase.from('plots').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('archived_at', null).eq('validation_status', s),
    ),
  );
  return Object.fromEntries(STATUSES.map((s, i) => [s, results[i]?.count ?? 0])) as Record<PlotStatus, number>;
}

/** One page of plots (no geometry) plus counts per status – fast for thousands of plots. */
export async function listPlots(organizationId: string, f: PlotListFilters) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('plots')
    .select('id, label, country, area_ha, validation_status, updated_at', { count: 'exact' })
    .eq('organization_id', organizationId);
  query = f.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (f.status) query = query.eq('validation_status', f.status);
  if (f.country) query = query.eq('country', f.country);
  if (f.supplier) query = query.eq('supplier_id', f.supplier);
  if (f.q) query = query.ilike('label', `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const from = (f.page - 1) * PAGE_SIZE;
  const archivedCount = supabase.from('plots').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).not('archived_at', 'is', null);
  const [list, archived, byStatus] = await Promise.all([query.order('label').range(from, from + PAGE_SIZE - 1), archivedCount, plotStatusCounts(organizationId)]);
  if (list.error) throw list.error;
  return { rows: (list.data ?? []) as PlotListRow[], total: list.count ?? 0, byStatus, archivedCount: archived.count ?? 0 };
}

export async function getPlot(organizationId: string, id: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('plots').select('*, supplier:suppliers (name)').eq('organization_id', organizationId).eq('id', id).maybeSingle();
  return data;
}
