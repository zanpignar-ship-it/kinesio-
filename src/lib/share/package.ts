import type * as GeoJSON from 'geojson';

/** Data of a buyer package – the JSON returned by public.buyer_package, also built for the owner's PDF. */
export type BuyerPackage = {
  expires_at: string | null;
  include_documents: boolean;
  organization: { name: string; country: string; tax_id: string | null; registration_no: string | null; eori: string | null; address: string | null };
  shipments: {
    id: string;
    internal_ref: string;
    shipment_date: string | null;
    status: string;
    activity: string;
    country_of_production: string | null;
    dds_reference_no: string | null;
    dds_verification_no: string | null;
    customer: string | null;
    items: { product: string; hs_code: string; trade_name: string | null; scientific_name: string | null; net_mass_kg: number | null; volume_m3: number | null; pieces: number | null }[];
    plots: { label: string; country: string; area_ha: number | null; geometry: GeoJSON.Geometry }[];
    documents: { title: string; type: string; valid_from: string | null; valid_to: string | null }[];
  }[];
};

export const isBuyerPackage = (v: unknown): v is BuyerPackage =>
  typeof v === 'object' && v !== null && 'shipments' in v && Array.isArray((v as { shipments: unknown }).shipments);
