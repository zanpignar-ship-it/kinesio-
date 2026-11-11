import 'server-only';
import type { Database } from '@/lib/db/database.types';
import type { PlotStatus } from '@/lib/geo/types';
import { createServerSupabase } from '@/lib/supabase/server';

export const PAGE_SIZE = 50;
const STATUSES: PlotStatus[] = ['valid', 'warning', 'error'];

export type PlotListFilters = { status?: PlotStatus; q?: string; country?: string; page: number };
export type PlotListRow = Pick<Database['public']['Tables']['plots']['Row'], 'id' | 'label' | 'country' | 'area_ha' | 'validation_status' | 'updated_at'>;

export function parseFilters(sp: Record<string, string | string[] | undefined>): PlotListFilters {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const status = one('status');
  const page = Number.parseInt(one('page') ?? '1', 10);
  return {
    status: STATUSES.includes(status as PlotStatus) ? (status as PlotStatus) : undefined,
    q: one('q')?.trim().slice(0, 100) || undefined,
    country: /^[A-Z]{2}$/.test(one('country') ?? '') ? one('country') : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** One page of plots (no geometry) plus counts per status – fast for thousands of plots. */
export async function listPlots(organizationId: string, f: PlotListFilters) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('plots')
    .select('id, label, country, area_ha, validation_status, updated_at', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('archived_at', null);
  if (f.status) query = query.eq('validation_status', f.status);
  if (f.country) query = query.eq('country', f.country);
  if (f.q) query = query.ilike('label', `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const from = (f.page - 1) * PAGE_SIZE;
  const counts = STATUSES.map((s) =>
    supabase.from('plots').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('archived_at', null).eq('validation_status', s),
  );
  const [list, ...countResults] = await Promise.all([query.order('label').range(from, from + PAGE_SIZE - 1), ...counts]);
  if (list.error) throw list.error;
  const byStatus = Object.fromEntries(STATUSES.map((s, i) => [s, countResults[i]?.count ?? 0])) as Record<PlotStatus, number>;
  return { rows: (list.data ?? []) as PlotListRow[], total: list.count ?? 0, byStatus };
}

export async function getPlot(organizationId: string, id: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('plots').select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle();
  return data;
}
