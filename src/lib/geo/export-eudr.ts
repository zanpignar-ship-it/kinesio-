import { booleanClockwise } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { EUDR_PROPERTY_NAMES, EXPORT_MAX_BYTES, MIN_COORD_DECIMALS } from '@/lib/eudr/rules';
import type { Issue, PlotGeometry } from './types';

export interface ExportPlot {
  label: string;
  geometry: PlotGeometry;
  producerName?: string;
  producerCountry?: string;
  areaHa?: number | null;
}

const FACTOR = 10 ** MIN_COORD_DECIMALS;
const round = (v: number): number => Math.round(v * FACTOR) / FACTOR;
const roundPos = (p: GeoJSON.Position): GeoJSON.Position => [round(p[0] ?? 0), round(p[1] ?? 0)];
const same = (a: GeoJSON.Position | undefined, b: GeoJSON.Position | undefined): boolean =>
  a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];

/** Round to 6 decimals, drop vertices that collapse after rounding, keep closed, RFC 7946 winding. */
function exportRing(ring: GeoJSON.Position[], isHole: boolean): GeoJSON.Position[] {
  const out = ring.map(roundPos).filter((p, i, arr) => i === 0 || !same(p, arr[i - 1]));
  if (!same(out[0], out[out.length - 1]) && out[0]) out.push([...out[0]]);
  if (out.length >= 4 && booleanClockwise(out) !== isHole) out.reverse();
  return out;
}

const exportPolygon = (rings: GeoJSON.Position[][]): GeoJSON.Position[][] => rings.map((r, i) => exportRing(r, i > 0));

function exportGeometry(g: PlotGeometry): PlotGeometry {
  switch (g.type) {
    case 'Point':
      return { type: 'Point', coordinates: roundPos(g.coordinates) };
    case 'MultiPoint':
      return { type: 'MultiPoint', coordinates: g.coordinates.map(roundPos) };
    case 'Polygon':
      return { type: 'Polygon', coordinates: exportPolygon(g.coordinates) };
    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: g.coordinates.map(exportPolygon) };
  }
}

/** GeoJSON for the EUDR Information System: one Feature per plot. */
export function buildEudrGeoJson(plots: ExportPlot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: plots.map((p) => {
      const properties: Record<string, string | number> = { [EUDR_PROPERTY_NAMES.productionPlace]: p.label };
      if (p.producerName) properties[EUDR_PROPERTY_NAMES.producerName] = p.producerName;
      if (p.producerCountry) properties[EUDR_PROPERTY_NAMES.producerCountry] = p.producerCountry.toUpperCase().slice(0, 2);
      const isPoint = p.geometry.type === 'Point' || p.geometry.type === 'MultiPoint';
      if (isPoint && typeof p.areaHa === 'number') properties[EUDR_PROPERTY_NAMES.area] = Math.round(p.areaHa * 10_000) / 10_000;
      return { type: 'Feature', properties, geometry: exportGeometry(p.geometry) };
    }),
  };
}

export function serializeEudrGeoJson(fc: GeoJSON.FeatureCollection): { text: string; bytes: number; issues: Issue[] } {
  const text = JSON.stringify(fc);
  const bytes = new TextEncoder().encode(text).length;
  const issues: Issue[] =
    bytes > EXPORT_MAX_BYTES ? [{ code: 'EXPORT_TOO_LARGE', severity: 'error', params: { bytes, max: EXPORT_MAX_BYTES } }] : [];
  return { text, bytes, issues };
}
