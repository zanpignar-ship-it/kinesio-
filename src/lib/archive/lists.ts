import 'server-only';
import { centroid } from '@turf/turf';
import { geometryFromDb } from '@/lib/plots/geometry';
import { createServerSupabase } from '@/lib/supabase/server';

const PAGE = 1000;

/** All active plots as flat rows for a spreadsheet (centre point instead of the full geometry). */
export async function plotRows(organizationId: string): Promise<Record<string, unknown>[]> {
  const supabase = await createServerSupabase();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('plots')
      .select('id, label, country, area_ha, validation_status, cadastral_no, cadastral_municipality, postal_address, harvest_from, harvest_to, geom, updated_at, supplier:suppliers (name)')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('label')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const p of data ?? []) {
      const g = geometryFromDb(p.geom);
      const c = g ? centroid(g).geometry.coordinates : null;
      rows.push({
        label: p.label,
        status: p.validation_status,
        country: p.country,
        supplier: p.supplier?.name ?? '',
        area_ha: p.area_ha,
        geometry: g?.type ?? '',
        lat: c ? c[1]!.toFixed(6) : '',
        lon: c ? c[0]!.toFixed(6) : '',
        harvest_from: p.harvest_from,
        harvest_to: p.harvest_to,
        cadastral_no: p.cadastral_no,
        cadastral_municipality: p.cadastral_municipality,
        postal_address: p.postal_address,
        updated_at: p.updated_at,
        id: p.id,
      });
    }
    if (!data || data.length < PAGE) return rows;
  }
}

export async function shipmentRows(organizationId: string): Promise<Record<string, unknown>[]> {
  const supabase = await createServerSupabase();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('shipments')
      .select('id, internal_ref, status, mode, activity, shipment_date, country_of_production, dds_reference_no, dds_verification_no, submitted_at, created_at, customer:customers (name), shipment_plots (count), shipment_items (net_mass_kg, volume_m3)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const s of data ?? []) {
      const sum = (k: 'net_mass_kg' | 'volume_m3') => s.shipment_items.reduce((n, i) => n + Number(i[k] ?? 0), 0);
      rows.push({
        internal_ref: s.internal_ref,
        status: s.status,
        customer: s.customer?.name ?? '',
        shipment_date: s.shipment_date,
        mode: s.mode,
        activity: s.activity,
        country_of_production: s.country_of_production,
        plots: s.shipment_plots[0]?.count ?? 0,
        net_mass_kg: sum('net_mass_kg') || '',
        volume_m3: sum('volume_m3') || '',
        dds_reference_no: s.dds_reference_no,
        dds_verification_no: s.dds_verification_no,
        submitted_at: s.submitted_at,
        created_at: s.created_at,
        id: s.id,
      });
    }
    if (!data || data.length < PAGE) return rows;
  }
}
