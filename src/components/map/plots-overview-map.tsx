'use client';

import type * as GeoJSON from 'geojson';
import { useRouter } from '@/i18n/navigation';
import { PlotMapClient } from './map-client';

/** Map of all plots; tapping a plot opens it. */
export function PlotsOverviewMap({ plots, className }: { plots: GeoJSON.FeatureCollection; className?: string }) {
  const router = useRouter();
  return <PlotMapClient className={className} plots={plots} onPlotClick={(id) => router.push(`/app/plots/${id}`)} />;
}
