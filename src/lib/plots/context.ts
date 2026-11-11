import 'server-only';
import type { Json } from '@/lib/db/database.types';
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

/** Existing plots near any of `geometries` (each geometry's box + ~50 m), used for duplicate detection. */
export async function nearbyPlots(
  supabase: Supabase,
  organizationId: string,
  geometries: PlotGeometry[],
  excludeId?: string,
): Promise<{ id: string; geometry: PlotGeometry }[]> {
  const found = new Map<string, PlotGeometry>();
  for (let i = 0; i < geometries.length; i += 500) {
    const { data, error } = await supabase.rpc('plots_near', {
      p_org: organizationId,
      p_geoms: geometries.slice(i, i + 500) as unknown as Json,
    });
    if (error) throw error;
    for (const r of data ?? []) if (r.id !== excludeId) found.set(r.id, r.geom as unknown as PlotGeometry);
  }
  return [...found].map(([id, geometry]) => ({ id, geometry }));
}
