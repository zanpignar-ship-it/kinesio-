import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DrawPlot } from '@/components/map/draw-plot';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { createServerSupabase } from '@/lib/supabase/server';
import type * as GeoJSON from 'geojson';

export default async function NewPlotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/plots/new');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const supabase = await createServerSupabase();
  const { data: others } = await supabase.rpc('plots_map', { p_org: current.organization.id });
  const t = await getTranslations('draw');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('newTitle')}</h1>
      <DrawPlot initial={{ country: current.organization.country, draw: null }} others={(others ?? undefined) as unknown as GeoJSON.FeatureCollection | undefined} />
    </div>
  );
}
