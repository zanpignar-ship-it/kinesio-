import 'server-only';
import { bbox } from '@turf/turf';
import type { PlotGeometry } from '@/lib/geo/types';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { createServerSupabase } from '@/lib/supabase/server';

/** Signed-in user with a current organization, or null. */
export async function getPlotContext() {
  const user = await getSessionUser();
  if (!user) return null;
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  return { user, organizationId: current.organization.id, organizationCountry: current.organization.country, supabase: await createServerSupabase() };
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Existing plots near `geometries` (bbox + ~50 m), used for duplicate detection. */
export async function nearbyPlots(
  supabase: Supabase,
  organizationId: string,
  geometries: PlotGeometry[],
  excludeId?: string,
): Promise<{ id: string; geometry: PlotGeometry }[]> {
  if (geometries.length === 0) return [];
  const [minx, miny, maxx, maxy] = bbox({ type: 'GeometryCollection', geometries });
  const pad = 0.0005;
  const { data, error } = await supabase.rpc('plots_in_bbox', {
    p_org: organizationId,
    p_minx: minx - pad,
    p_miny: miny - pad,
    p_maxx: maxx + pad,
    p_maxy: maxy + pad,
    ...(excludeId ? { p_exclude: excludeId } : {}),
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, geometry: r.geom as unknown as PlotGeometry }));
}
