'use client';

import dynamic from 'next/dynamic';

/** MapLibre needs the browser (WebGL); never render it on the server. */
export const PlotMapClient = dynamic(() => import('./plot-map').then((m) => m.PlotMap), {
  ssr: false,
  loading: () => <div className="bg-muted h-full min-h-72 w-full animate-pulse rounded-xl" />,
});
