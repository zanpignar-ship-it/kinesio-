import 'server-only';
import type * as GeoJSON from 'geojson';
import { createServerSupabase } from '@/lib/supabase/server';

export type PortalInfo = {
  link_id: string;
  organization_id: string;
  expires_at: string;
  organization: string;
  supplier: string;
  country: string;
  plots: { id: string; label: string; country: string; area_ha: number | null; harvest_from: string | null; harvest_to: string | null; validation_status: string; geometry: GeoJSON.Geometry | null }[];
  documents: { id: string; title: string; type: string; valid_to: string | null }[];
};

export async function portalInfo(token: string): Promise<PortalInfo | null> {
  if (!/^[\w-]{32,100}$/.test(token)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('supplier_portal_info', { p_token: token });
  return (data as unknown as PortalInfo | null) ?? null;
}
