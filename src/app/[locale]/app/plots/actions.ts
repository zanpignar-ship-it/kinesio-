'use server';

import { revalidatePath } from 'next/cache';
import type * as GeoJSON from 'geojson';
import { redirect } from '@/i18n/navigation';
import type { Json } from '@/lib/db/database.types';
import type { DecimalStats, PlotGeometry } from '@/lib/geo/types';
import { getPlotContext, nearbyPlots } from '@/lib/plots/context';
import { geometrySchema, plotFormSchema } from '@/lib/plots/schemas';
import { preparePlot, type PreparedPlot } from '@/lib/plots/service';

export type PlotFormState = { error?: string; values?: Record<string, string> };

const MAX_IMPORT = 2000;

function readForm(formData: FormData): Record<string, string> {
  return Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
}

function parseGeometry(raw: string | undefined): GeoJSON.Geometry | null | 'invalid' {
  if (!raw) return null;
  try {
    const parsed = geometrySchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as GeoJSON.Geometry) : 'invalid';
  } catch {
    return 'invalid';
  }
}

const toRow = (p: PreparedPlot) => ({ ...p, geom: p.geom as unknown as string | null, validation_issues: p.validation_issues as unknown as Json });

async function savePlot(formData: FormData, plotId: string | null): Promise<PlotFormState> {
  const values = readForm(formData);
  const locale = values.locale ?? 'sl';
  const ctx = await getPlotContext();
  if (!ctx) redirect({ href: '/login', locale });
  const { supabase, organizationId } = ctx!;
  const form = plotFormSchema.safeParse(values);
  if (!form.success) return { error: form.error.issues[0]?.message, values };
  const geometry = parseGeometry(values.geometry);
  if (geometry === 'invalid') return { error: 'plots.errors.geometry', values };
  if (!geometry && !form.data.postalAddress) return { error: 'plots.errors.geometryRequired', values };

  const others = geometry ? await nearbyPlots(supabase, organizationId, [geometry as PlotGeometry], plotId ?? undefined) : [];
  const row = toRow(preparePlot({ ...form.data, geometry }, others));

  if (plotId) {
    const { error } = await supabase.from('plots').update(row).eq('id', plotId).eq('organization_id', organizationId);
    if (error) return { error: 'plots.errors.unknown', values };
    revalidatePath(`/${locale}/app/plots`);
    redirect({ href: `/app/plots/${plotId}`, locale });
  }
  const { data, error } = await supabase
    .from('plots')
    .insert({ ...row, organization_id: organizationId })
    .select('id')
    .single();
  if (error || !data) return { error: 'plots.errors.unknown', values };
  revalidatePath(`/${locale}/app/plots`);
  redirect({ href: `/app/plots/${data.id}`, locale });
  return {};
}

export async function createPlot(_prev: PlotFormState, formData: FormData): Promise<PlotFormState> {
  return savePlot(formData, null);
}

export async function updatePlot(_prev: PlotFormState, formData: FormData): Promise<PlotFormState> {
  const id = formData.get('id');
  return savePlot(formData, typeof id === 'string' ? id : null);
}

export async function archivePlot(_prev: PlotFormState, formData: FormData): Promise<PlotFormState> {
  const { id, locale = 'sl', restore } = readForm(formData);
  const ctx = await getPlotContext();
  if (!ctx || !id) return { error: 'plots.errors.unknown' };
  const { error } = await ctx.supabase
    .from('plots')
    .update({ archived_at: restore ? null : new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);
  if (error) return { error: 'plots.errors.unknown' };
  revalidatePath(`/${locale}/app/plots`);
  redirect({ href: '/app/plots', locale });
  return {};
}

export async function deletePlot(_prev: PlotFormState, formData: FormData): Promise<PlotFormState> {
  const { id, locale = 'sl' } = readForm(formData);
  const ctx = await getPlotContext();
  if (!ctx || !id) return { error: 'plots.errors.unknown' };
  const { error } = await ctx.supabase.from('plots').delete().eq('id', id).eq('organization_id', ctx.organizationId);
  // A plot used by a shipment fails the (deferred) foreign key at commit.
  if (error) return { error: error.code === '23503' ? 'plots.errors.inUse' : 'plots.errors.unknown' };
  revalidatePath(`/${locale}/app/plots`);
  redirect({ href: '/app/plots', locale });
  return {};
}

export type ImportRow = { label: string; geometry: GeoJSON.Geometry | null; declaredAreaHa?: number; decimals: DecimalStats | null };
export type ImportPayload = {
  locale: string;
  country: string;
  fileName: string;
  filePath: string | null;
  detectedCrs: string;
  rows: ImportRow[];
};
export type ImportResult = { error?: string; inserted?: number; counts?: { valid: number; warning: number; error: number } };

/** Save many plots at once (one insert). Every row is validated again on the server. */
export async function importPlots(payload: ImportPayload): Promise<ImportResult> {
  const ctx = await getPlotContext();
  if (!ctx) return { error: 'plots.errors.unknown' };
  if (payload.rows.length === 0) return { error: 'plots.import.empty' };
  if (payload.rows.length > MAX_IMPORT) return { error: 'plots.errors.tooMany' };
  const form = plotFormSchema.safeParse({ label: 'x', country: payload.country });
  if (!form.success) return { error: 'plots.errors.country' };
  const { supabase, organizationId } = ctx;

  const geoms = payload.rows.flatMap((r) => {
    const g = r.geometry ? geometrySchema.safeParse(r.geometry) : null;
    return g?.success ? [g.data as PlotGeometry] : [];
  });
  const existing = await nearbyPlots(supabase, organizationId, geoms);

  const { data: imp, error: impError } = await supabase
    .from('plot_imports')
    .insert({
      organization_id: organizationId,
      file_name: payload.fileName.slice(0, 255),
      file_path: payload.filePath ?? '',
      detected_crs: payload.detectedCrs,
      feature_count: payload.rows.length,
    })
    .select('id')
    .single();
  if (impError || !imp) return { error: 'plots.errors.unknown' };

  const counts = { valid: 0, warning: 0, error: 0 };
  const seen: { id: string; geometry: PlotGeometry }[] = [...existing];
  const rows = payload.rows.map((r, i) => {
    const parsed = r.geometry ? geometrySchema.safeParse(r.geometry) : null;
    const geometry = parsed?.success ? (parsed.data as GeoJSON.Geometry) : null;
    const label = r.label.trim().slice(0, 120) || `${i + 1}`;
    const prepared = preparePlot({ label, country: payload.country, geometry, declaredAreaHa: r.declaredAreaHa, decimals: r.decimals }, seen);
    counts[prepared.validation_status] += 1;
    if (prepared.geom) seen.push({ id: `import-${i + 1}`, geometry: prepared.geom });
    return { ...toRow(prepared), organization_id: organizationId, source_import_id: imp.id };
  });
  const { error } = await supabase.from('plots').insert(rows);
  if (error) return { error: 'plots.errors.unknown' };
  revalidatePath(`/${payload.locale}/app/plots`);
  return { inserted: rows.length, counts };
}
