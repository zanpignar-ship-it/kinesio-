import type { StyleSpecification } from 'maplibre-gl';

export type Basemap = 'satellite' | 'streets';

/** Raster basemaps. To change provider, edit only this file. */
const SOURCES = {
  satellite: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
  },
  streets: {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
} as const;

export function basemapStyle(base: Basemap): StyleSpecification {
  const s = SOURCES[base];
  return {
    version: 8,
    sources: { base: { type: 'raster', tiles: [...s.tiles], tileSize: 256, attribution: s.attribution, maxzoom: s.maxzoom } },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

/** Slovenia, Croatia, Bosnia and Herzegovina, Serbia. */
export const DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [13.3, 42.2],
  [23.1, 46.9],
];

export const STATUS_COLORS = { valid: '#059669', warning: '#d97706', error: '#dc2626' } as const;
