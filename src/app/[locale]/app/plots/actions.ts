'use server';

import { revalidatePath } from 'next/cache';
import type * as GeoJSON from 'geojson';
import { redirect } from '@/i18n/navigation';
import type { Json } from '@/lib/db/database.types';
import type { PlotGeometry } from '@/lib/geo/types';
import { getPlotContext, nearbyPlots } from '@/lib/plots/context';
import { geometrySchema, importPayloadSchema, plotFormSchema } from '@/lib/plots/schemas';
import { prepareDrawnPlot, preparePlot, type PreparedPlot } from '@/lib/plots/service';
import { geometryFromDb } from '@/lib/plots/geometry';
import { repairSelfIntersections } from '@/lib/geo/repair';
import { bulkChanges, bulkSchema } from '@/lib/plots/bulk';

export type PlotFormState = { error?: string; values?: Record<string, string> };


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

  let others: { id: string; geometry: PlotGeometry }[] = [];
  try {
    others = geometry ? await nearbyPlots(supabase, organizationId, [geometry as PlotGeometry], plotId ?? undefined) : [];
  } catch {
    return { error: 'plots.errors.unknown', values };
  }
  const row = { ...toRow(prepareDrawnPlot({ ...form.data, geometry }, others)), supplier_id: form.data.supplierId ?? null, harvest_from: form.data.harvestFrom ?? null, harvest_to: form.data.harvestTo ?? null };

  if (plotId) {
    // The edit form has no address field: keep a stored address instead of clearing it.
    const update: Partial<typeof row> = { ...row };
    if (form.data.postalAddress === undefined) delete update.postal_address;
    const { error } = await supabase.from('plots').update(update).eq('id', plotId).eq('organization_id', organizationId);
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

/** Split a self-intersecting outline into simple polygons and validate again (the user checks the map afterwards). */
export async function repairPlot(_prev: PlotFormState, formData: FormData): Promise<PlotFormState> {
  const { id, locale = 'sl' } = readForm(formData);
  const ctx = await getPlotContext();
  if (!ctx || !id) return { error: 'plots.errors.unknown' };
  const { supabase, organizationId } = ctx;
  const { data: plot } = await supabase.from('plots').select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle();
  const geometry = geometryFromDb(plot?.geom);
  if (!plot || !geometry) return { error: 'plots.errors.unknown' };
  const { geometry: repaired, changed } = repairSelfIntersections(geometry);
  if (!changed) return { error: 'plots.errors.notRepairable' };
  let others: { id: string; geometry: PlotGeometry }[] = [];
  try {
    others = await nearbyPlots(supabase, organizationId, [repaired as PlotGeometry], id);
  } catch {
    return { error: 'plots.errors.unknown' };
  }
  const row = toRow(
    prepareDrawnPlot(
      {
        label: plot.label,
        country: plot.country,
        geometry: repaired,
        declaredAreaHa: plot.area_source === 'declared' && plot.area_ha !== null ? Number(plot.area_ha) : undefined,
        cadastralNo: plot.cadastral_no ?? undefined,
        cadastralMunicipality: plot.cadastral_municipality ?? undefined,
        postalAddress: plot.postal_address ?? undefined,
      },
      others,
    ),
  );
  const { error } = await supabase
    .from('plots')
    .update({ geom: row.geom, area_ha: row.area_ha, area_source: row.area_source, validation_status: row.validation_status, validation_issues: row.validation_issues })
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) return { error: 'plots.errors.unknown' };
  revalidatePath(`/${locale}/app/plots`);
  redirect({ href: `/app/plots/${id}`, locale });
  return {};
}

export type BulkState = { error?: string; updated?: number };

/** Set supplier / harvest dates on, or archive, the plots ticked in the list. */
export async function bulkUpdatePlots(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const ctx = await getPlotContext();
  if (!ctx) return { error: 'plots.errors.unknown' };
  const parsed = bulkSchema.safeParse({
    ids: formData.getAll('ids').map(String),
    action: formData.get('action'),
    supplier: String(formData.get('supplier') ?? ''),
    harvestFrom: String(formData.get('harvestFrom') ?? ''),
    harvestTo: String(formData.get('harvestTo') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'plots.errors.unknown' };
  const changes = bulkChanges(parsed.data);
  if (!changes) return { error: 'plots.errors.nothingToChange' };
  const { data, error } = await ctx.supabase.from('plots').update(changes).eq('organization_id', ctx.organizationId).in('id', parsed.data.ids).select('id');
  if (error) return { error: 'plots.errors.unknown' };
  revalidatePath(`/${locale}/app/plots`);
  return { updated: data?.length ?? 0 };
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

/** What the browser sends; everything is re-checked with importPayloadSchema. */
export type ImportPayload = {
  locale: string;
  country: string;
  fileName: string;
  filePath: string | null;
  detectedCrs: string;
  supplierId?: string | null;
  harvestFrom?: string | null;
  harvestTo?: string | null;
  rows: { label: unknown; geometry: unknown; declaredAreaHa?: unknown; decimals: unknown }[];
};
export type ImportResult = { error?: string; inserted?: number; counts?: { valid: number; warning: number; error: number } };

/** Save many plots at once (one insert). Every row is validated again on the server. */
export async function importPlots(input: ImportPayload): Promise<ImportResult> {
  try {
    return await importPlotsUnsafe(input);
  } catch {
    return { error: 'plots.errors.unknown' };
  }
}

async function importPlotsUnsafe(input: ImportPayload): Promise<ImportResult> {
  const ctx = await getPlotContext();
  if (!ctx) return { error: 'plots.errors.unknown' };
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.path[0] === 'rows' && i.code === 'too_big');
    const empty = parsed.error.issues.some((i) => i.path[0] === 'rows' && i.code === 'too_small');
    return { error: tooMany ? 'plots.errors.tooMany' : empty ? 'imp.empty' : 'plots.errors.unknown' };
  }
  const payload = parsed.data;
  const { supabase, organizationId } = ctx;
  // Only files inside the organization's own folder can be referenced.
  const filePath = payload.filePath && payload.filePath.startsWith(`${organizationId}/`) ? payload.filePath : null;

  const geoms = payload.rows.flatMap((r) => (r.geometry ? [r.geometry as PlotGeometry] : []));
  const existing = await nearbyPlots(supabase, organizationId, geoms);

  const { data: imp, error: impError } = await supabase
    .from('plot_imports')
    .insert({
      organization_id: organizationId,
      file_name: payload.fileName,
      file_path: filePath ?? '',
      detected_crs: payload.detectedCrs,
      feature_count: payload.rows.length,
    })
    .select('id')
    .single();
  if (impError || !imp) return { error: 'plots.errors.unknown' };

  const counts = { valid: 0, warning: 0, error: 0 };
  const seen: { id: string; geometry: PlotGeometry }[] = [...existing];
  const rows = payload.rows.map((r, i) => {
    const label = r.label || `${i + 1}`;
    const prepared = preparePlot(
      { label, country: payload.country, geometry: r.geometry as GeoJSON.Geometry | null, declaredAreaHa: r.declaredAreaHa, decimals: r.decimals },
      seen,
    );
    counts[prepared.validation_status] += 1;
    if (prepared.geom) seen.push({ id: label, geometry: prepared.geom });
    return { ...toRow(prepared), organization_id: organizationId, source_import_id: imp.id, supplier_id: payload.supplierId ?? null, harvest_from: payload.harvestFrom ?? null, harvest_to: payload.harvestTo ?? null };
  });
  const { error } = await supabase.from('plots').insert(rows);
  if (error) {
    // Do not leave an import record without plots.
    await supabase.from('plot_imports').delete().eq('id', imp.id);
    return { error: 'plots.errors.unknown' };
  }
  revalidatePath(`/${payload.locale}/app/plots`);
  return { inserted: rows.length, counts };
}
