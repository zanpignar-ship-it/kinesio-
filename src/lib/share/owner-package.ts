import 'server-only';
import type { Membership } from '@/lib/auth/session';
import { getShipment } from '@/lib/shipments/queries';
import { createServerSupabase } from '@/lib/supabase/server';
import type { BuyerPackage } from './package';

/** The buyer package for one shipment, built for its owner (same shape as public.buyer_package). */
export async function ownerPackage(m: Membership, shipmentId: string, locale: string): Promise<BuyerPackage | null> {
  const data = await getShipment(m.organization.id, shipmentId, locale);
  if (!data) return null;
  const supabase = await createServerSupabase();
  const { data: org } = await supabase.from('organizations').select('name, country, tax_id, registration_no, eori, address').eq('id', m.organization.id).single();
  const { data: docs } = await supabase
    .from('shipment_documents')
    .select('document:documents (title, type, valid_from, valid_to)')
    .eq('shipment_id', shipmentId);
  const fc = JSON.parse(data.geojson.text) as { features: { properties: { ProductionPlace: string; ProducerCountry?: string; Area?: number }; geometry: BuyerPackage['shipments'][number]['plots'][number]['geometry'] }[] };
  const sh = data.shipment;
  return {
    expires_at: null,
    include_documents: true,
    organization: org ?? { name: m.organization.name, country: m.organization.country, tax_id: null, registration_no: null, eori: null, address: null },
    shipments: [
      {
        id: sh.id,
        internal_ref: sh.internal_ref,
        shipment_date: sh.shipment_date,
        status: sh.status,
        activity: sh.activity,
        country_of_production: sh.country_of_production,
        dds_reference_no: sh.dds_reference_no,
        dds_verification_no: sh.dds_verification_no,
        customer: sh.customer?.name ?? null,
        items: data.items.map((i) => ({ product: i.product, hs_code: i.hsCode, trade_name: i.tradeName, scientific_name: i.scientificName, net_mass_kg: i.netMassKg, volume_m3: i.volumeM3, pieces: i.pieces })),
        plots: fc.features.map((f) => ({ label: f.properties.ProductionPlace, country: f.properties.ProducerCountry ?? '', area_ha: f.properties.Area ?? null, geometry: f.geometry })),
        documents: (docs ?? []).flatMap((d) => (d.document ? [d.document] : [])),
      },
    ],
  };
}
