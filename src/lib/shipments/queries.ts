import 'server-only';
import type * as GeoJSON from 'geojson';
import type { Database } from '@/lib/db/database.types';
import { documentExpiry } from '@/lib/documents/expiry';
import { buildEudrGeoJson, serializeEudrGeoJson, type ExportPlot } from '@/lib/geo/export-eudr';
import type { PlotGeometry } from '@/lib/geo/types';
import { geometryFromDb } from '@/lib/plots/geometry';
import { EXPORT_MAX_BYTES } from '@/lib/eudr/rules';
import { simplifyToFit } from '@/lib/geo/repair';
import { shipmentRisk } from './risk';
import { createServerSupabase } from '@/lib/supabase/server';
import { productOptions } from '@/lib/masterdata/queries';
import { checkReadiness, type ReadinessInput } from './readiness';

type Status = Database['public']['Enums']['shipment_status'];

export async function listShipments(organizationId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('shipments')
    .select('id, internal_ref, status, shipment_date, mode, dds_reference_no, customer:customers (name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function shipmentFormOptions(organizationId: string, locale: string) {
  const supabase = await createServerSupabase();
  const [customers, products, suppliers, plots, documents, opts, map] = await Promise.all([
    supabase.from('customers').select('id, name').eq('organization_id', organizationId).order('name'),
    supabase.from('products').select('id, name, hs_code').eq('organization_id', organizationId).order('name'),
    supabase.from('suppliers').select('id, name').eq('organization_id', organizationId).order('name'),
    supabase.from('plots').select('id, label, validation_status').eq('organization_id', organizationId).is('archived_at', null).order('label').limit(2000),
    supabase.from('documents').select('id, title').eq('organization_id', organizationId).order('title').limit(2000),
    productOptions(locale),
    supabase.rpc('plots_map', { p_org: organizationId }),
  ]);
  return {
    customers: customers.data ?? [],
    products: (products.data ?? []).map((p) => ({ id: p.id, label: `${p.name} (${p.hs_code})` })),
    suppliers: suppliers.data ?? [],
    plots: (plots.data ?? []).map((p) => ({ id: p.id, label: p.label })),
    documents: (documents.data ?? []).map((d) => ({ id: d.id, label: d.title })),
    hsCodes: opts.hsCodes,
    plotsMap: (map.data ?? { type: 'FeatureCollection', features: [] }) as unknown as GeoJSON.FeatureCollection,
  };
}

/** Everything about one shipment, plus the readiness check and the EUDR GeoJSON built from the plot snapshots. */
export async function getShipment(organizationId: string, id: string, locale: string) {
  const supabase = await createServerSupabase();
  const { data: s } = await supabase
    .from('shipments')
    .select(
      `*, customer:customers (id, name, country),
       shipment_items (id, product_id, net_mass_kg, volume_m3, pieces, plot_ids, product:products (name, hs_code, trade_name, species:species (scientific_name, common_name_sl, common_name_hr, common_name_sr, common_name_bs, common_name_en), hs:hs_codes (in_scope))),
       shipment_plots (plot_id, geom_snapshot, plot:plots (label, country, area_ha, validation_status, harvest_from, harvest_to, supplier:suppliers (name))),
       shipment_documents (document_id, document:documents (title, valid_to)),
       upstream_references (id, kind, reference_no, verification_no, supplier_id)`,
    )
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();
  if (!s) return null;

  const plotIds = s.shipment_plots.map((p) => p.plot_id);
  // Small id batches (URL length) and paging (1000-row limit), so large shipments are counted completely.
  const links: { plot_id: string; document: { valid_to: string | null } | null }[] = [];
  for (let i = 0; i < plotIds.length; i += 150) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from('plot_documents')
        .select('plot_id, document_id, document:documents (valid_to)')
        .eq('organization_id', organizationId)
        .in('plot_id', plotIds.slice(i, i + 150))
        .order('plot_id')
        .order('document_id')
        .range(from, from + 999);
      links.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const docsByPlot = new Map<string, { count: number; expired: number }>();
  for (const l of links) {
    const e = docsByPlot.get(l.plot_id) ?? { count: 0, expired: 0 };
    e.count += 1;
    if (l.document && documentExpiry(l.document.valid_to) === 'expired') e.expired += 1;
    docsByPlot.set(l.plot_id, e);
  }

  const exportPlots: ExportPlot[] = s.shipment_plots.flatMap((sp) => {
    const g = geometryFromDb(sp.geom_snapshot);
    if (!g || !sp.plot) return [];
    const plot: ExportPlot = { id: sp.plot_id, label: sp.plot.label, geometry: g as PlotGeometry, producerCountry: sp.plot.country, areaHa: sp.plot.area_ha === null ? null : Number(sp.plot.area_ha) };
    if (sp.plot.supplier?.name) plot.producerName = sp.plot.supplier.name;
    return [plot];
  });
  let finalPlots = exportPlots;
  let geojson = serializeEudrGeoJson(buildEudrGeoJson(exportPlots));
  // Over the EUDR size limit: simplify the polygons (topology kept) until the file fits.
  let simplified: { tolerance: number; verticesBefore: number; verticesAfter: number } | null = null;
  if (geojson.bytes > EXPORT_MAX_BYTES) {
    const size = (gs: GeoJSON.Geometry[]) =>
      serializeEudrGeoJson(buildEudrGeoJson(exportPlots.map((p, i) => ({ ...p, geometry: gs[i] as PlotGeometry })))).bytes;
    const fit = simplifyToFit(exportPlots.map((p) => p.geometry), EXPORT_MAX_BYTES, size);
    if (fit && fit.tolerance > 0) {
      finalPlots = exportPlots.map((p, i) => ({ ...p, geometry: fit.geometries[i] as PlotGeometry }));
      geojson = serializeEudrGeoJson(buildEudrGeoJson(finalPlots));
      simplified = { tolerance: fit.tolerance, verticesBefore: fit.verticesBefore, verticesAfter: fit.verticesAfter };
    }
  }

  const common = (sp: { common_name_sl: string; common_name_hr: string; common_name_sr: string; common_name_bs: string; common_name_en: string } | null) =>
    !sp ? null : locale === 'sl' ? sp.common_name_sl : locale === 'hr' ? sp.common_name_hr : locale === 'sr-Latn' ? sp.common_name_sr : locale === 'bs' ? sp.common_name_bs : sp.common_name_en;

  const items = s.shipment_items.map((i) => ({
    id: i.id,
    productId: i.product_id,
    product: i.product?.name ?? '',
    hsCode: i.product?.hs_code ?? '',
    hsInScope: i.product?.hs?.in_scope ?? false,
    tradeName: i.product?.trade_name ?? null,
    scientificName: i.product?.species?.scientific_name ?? null,
    commonName: common(i.product?.species ?? null),
    netMassKg: i.net_mass_kg === null ? null : Number(i.net_mass_kg),
    volumeM3: i.volume_m3 === null ? null : Number(i.volume_m3),
    pieces: i.pieces,
    plotIds: i.plot_ids ?? [],
  }));
  const plots = s.shipment_plots.map((sp) => ({
    id: sp.plot_id,
    label: sp.plot?.label ?? '',
    status: sp.plot?.validation_status ?? ('error' as const),
    hasGeometry: Boolean(sp.geom_snapshot),
    documentCount: docsByPlot.get(sp.plot_id)?.count ?? 0,
    expiredDocuments: docsByPlot.get(sp.plot_id)?.expired ?? 0,
    hasHarvestDate: Boolean(sp.plot?.harvest_from || sp.plot?.harvest_to),
    harvestFrom: sp.plot?.harvest_from ?? null,
    harvestTo: sp.plot?.harvest_to ?? null,
  }));
  const { data: risks } = await supabase.from('country_risk').select('country, risk');
  const riskLevel = shipmentRisk([s.country_of_production, ...s.shipment_plots.map((sp) => sp.plot?.country ?? null)], risks ?? []);
  const readinessInput: ReadinessInput = {
    mode: s.mode,
    activity: s.activity,
    countryOfProduction: s.country_of_production,
    items,
    plots,
    upstreamReferences: s.upstream_references.length,
    geojsonBytes: geojson.bytes,
    geojsonSimplified: simplified !== null,
    risk: { level: riskLevel, assessed: Boolean(s.risk_assessment?.trim()), negligible: s.risk_negligible },
  };
  return {
    shipment: s,
    status: s.status as Status,
    items,
    plots,
    documents: s.shipment_documents.map((d) => ({ id: d.document_id, title: d.document?.title ?? '', expiry: documentExpiry(d.document?.valid_to ?? null) })),
    references: s.upstream_references,
    readiness: checkReadiness(readinessInput),
    geojson,
    exportPlots: finalPlots,
    riskLevel,
  };
}
