'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike, Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import { bbox } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { basemapStyle, DEFAULT_BOUNDS, STATUS_COLORS, type Basemap } from '@/lib/map/basemaps';
import type { DrawState } from '@/lib/map/draw-state';
import { cn } from '@/lib/utils';

export type PlotMapProps = {
  /** Saved plots to show (properties: id, label, validation_status; `selected: true` highlights a plot). */
  plots?: GeoJSON.FeatureCollection;
  /** Drawing in progress (vertices are draggable). */
  draft?: DrawState;
  onAdd?: (position: GeoJSON.Position) => void;
  onMove?: (index: number, position: GeoJSON.Position) => void;
  onPlotClick?: (id: string) => void;
  className?: string;
};

// Worker files are copied to /public/maplibre by scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const SELECTED_COLOR = '#2563eb';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function draftFeatures(draft: DrawState | undefined): GeoJSON.FeatureCollection {
  if (!draft || draft.vertices.length === 0) return EMPTY;
  const v = draft.vertices;
  const features: GeoJSON.Feature[] = [];
  if (draft.mode === 'polygon' && v.length >= 3) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...v, v[0]!]] } });
  } else if (draft.mode === 'polygon' && v.length === 2) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: v } });
  }
  return { type: 'FeatureCollection', features };
}

function boundsOf(fc: GeoJSON.FeatureCollection | undefined): LngLatBoundsLike | null {
  if (!fc || fc.features.length === 0) return null;
  const [a, b, c, d] = bbox(fc);
  return [
    [a, b],
    [c, d],
  ];
}

export function PlotMap({ plots, draft, onAdd, onMove, onPlotClick, className }: PlotMapProps) {
  const t = useTranslations('map');
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const handlers = useRef({ onAdd, onMove, onPlotClick });
  useLayoutEffect(() => {
    handlers.current = { onAdd, onMove, onPlotClick };
  });
  const data = useRef({ plots, draft });
  useLayoutEffect(() => {
    data.current = { plots, draft };
  });
  const [base, setBase] = useState<Basemap>('satellite');
  const [ready, setReady] = useState(false);
  const [locateError, setLocateError] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const initial = boundsOf(plots) ?? (draft && draft.vertices.length ? boundsOf({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: draft.vertices } }] }) : null);
    const map = new maplibregl.Map({
      container: container.current,
      style: basemapStyle('satellite'),
      bounds: initial ?? DEFAULT_BOUNDS,
      fitBoundsOptions: { padding: 40, maxZoom: 17 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    // While drawing, a double tap must add a corner, not zoom (and add two corners).
    if (handlers.current.onAdd) map.doubleClickZoom.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const addLayers = () => {
      if (!map.getSource('plots')) {
        map.addSource('plots', { type: 'geojson', data: data.current.plots ?? EMPTY });
        const color = ['match', ['get', 'validation_status'], 'valid', STATUS_COLORS.valid, 'warning', STATUS_COLORS.warning, STATUS_COLORS.error] as unknown as string;
        const selected = ['==', ['get', 'selected'], true];
        const pick = <T,>(yes: T, no: T) => ['case', selected, yes, no] as unknown as T;
        map.addLayer({ id: 'plots-fill', type: 'fill', source: 'plots', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': pick(0.5, 0.25) } });
        map.addLayer({ id: 'plots-line', type: 'line', source: 'plots', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': pick(SELECTED_COLOR, color), 'line-width': pick(4, 2) } });
        map.addLayer({ id: 'plots-point', type: 'circle', source: 'plots', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': color, 'circle-radius': pick(9, 7), 'circle-stroke-color': pick(SELECTED_COLOR, '#fff'), 'circle-stroke-width': pick(4, 2) } });
      }
      if (!map.getSource('draft')) {
        map.addSource('draft', { type: 'geojson', data: draftFeatures(data.current.draft) });
        map.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#facc15', 'fill-opacity': 0.3 } });
        map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', paint: { 'line-color': '#facc15', 'line-width': 3 } });
      }
    };
    // 'style.load' fires for the first style and after every setStyle (basemap switch).
    map.on('style.load', addLayers);
    map.on('load', () => setReady(true));
    // Exposed for tests: set once the plots are drawn (without waiting for every basemap tile).
    const onRender = () => {
      if ((data.current.plots?.features.length ?? 0) === 0 || !map.getLayer('plots-fill')) return;
      const shown = map.queryRenderedFeatures({ layers: ['plots-fill', 'plots-point'] }).length;
      if (shown > 0) {
        container.current?.setAttribute('data-plots-rendered', String(shown));
        map.off('render', onRender);
      }
    };
    map.on('render', onRender);
    // Exposed for tests and debugging: how many draft polygons are actually rendered.
    map.on('idle', () => {
      const n = map.getLayer('draft-fill') ? map.queryRenderedFeatures({ layers: ['draft-fill'] }).length : 0;
      container.current?.setAttribute('data-draft-rendered', String(n));

    });
    map.on('click', (e: MapMouseEvent) => {
      const hit = map.getLayer('plots-fill') ? map.queryRenderedFeatures(e.point, { layers: ['plots-fill', 'plots-point'] }) : [];
      const id = hit[0]?.properties?.id;
      if (typeof id === 'string' && handlers.current.onPlotClick) handlers.current.onPlotClick(id);
      else handlers.current.onAdd?.([e.lngLat.lng, e.lngLat.lat]);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (mapRef.current?.getSource('plots') as GeoJSONSource | undefined)?.setData(plots ?? EMPTY);
  }, [plots, ready, base]);

  // Draft polygon/line + draggable vertex markers (work with touch).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('draft') as GeoJSONSource | undefined)?.setData(draftFeatures(draft));
    container.current?.setAttribute('data-draft-features', String(draftFeatures(draft).features.length));
    for (const m of markers.current) m.remove();
    markers.current = (draft?.vertices ?? []).map((v, i) => {
      const el = document.createElement('div');
      el.className = 'size-5 rounded-full border-2 border-white bg-yellow-400 shadow';
      el.setAttribute('data-testid', 'draft-vertex');
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([v[0] ?? 0, v[1] ?? 0]).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        handlers.current.onMove?.(i, [p.lng, p.lat]);
      });
      el.addEventListener('click', (e) => e.stopPropagation());
      return marker;
    });
  }, [draft, ready, base]);

  const switchBase = (next: Basemap) => {
    setBase(next);
    mapRef.current?.setStyle(basemapStyle(next));
  };

  const locate = () => {
    setLocateError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }),
      () => setLocateError(true),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl border', className)}>
      <div ref={container} data-testid="plot-map" aria-label={t('label')} className="h-full min-h-72 w-full" />
      <div className="absolute top-2 left-2 flex gap-1">
        {(['satellite', 'streets'] as const).map((b) => (
          <Button key={b} type="button" size="sm" variant={base === b ? 'default' : 'secondary'} onClick={() => switchBase(b)} className="h-11 sm:h-9">
            {t(b)}
          </Button>
        ))}
      </div>
      <div className="absolute bottom-8 left-2 flex flex-col items-start gap-1">
        <Button type="button" size="sm" variant="secondary" onClick={locate} className="h-11 sm:h-9">
          {t('locate')}
        </Button>
        {locateError ? <span className="rounded bg-white/90 px-2 py-1 text-xs text-red-700">{t('locateError')}</span> : null}
      </div>
    </div>
  );
}
