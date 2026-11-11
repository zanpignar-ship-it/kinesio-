import { booleanPointInPolygon, pointToPolygonDistance } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { COUNTRY_TOLERANCE_METERS } from '@/lib/eudr/rules';
import { allPositions } from './coords';
import countries from './data/countries.json';
import type { Issue, PlotGeometry } from './types';

type Border = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { iso: string }>;

const BORDERS = new Map<string, Border>(
  (countries.features as unknown as Border[]).map((f) => [f.properties.iso, f]),
);

/** Simplified border (Natural Earth 1:10m) or null when we have no data for the country. */
export function countryBorder(iso: string): Border | null {
  return BORDERS.get(iso) ?? null;
}

function distanceOutside(p: GeoJSON.Position, border: Border): number {
  if (booleanPointInPolygon(p, border)) return 0;
  // Turf: distance to the nearest edge; for MultiPolygon take the closest part.
  const g = border.geometry;
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return Math.min(...parts.map((rings) => Math.abs(pointToPolygonDistance(p, { type: 'Polygon', coordinates: rings }, { units: 'meters' }))));
}

export function checkCountry(geometry: PlotGeometry, country: string): Issue[] {
  const border = countryBorder(country);
  if (!border) return [{ code: 'COUNTRY_CHECK_UNAVAILABLE', severity: 'info', params: { country } }];
  const outside = allPositions(geometry).some((p) => distanceOutside(p, border) > COUNTRY_TOLERANCE_METERS);
  return outside ? [{ code: 'OUTSIDE_COUNTRY', severity: 'error', params: { country } }] : [];
}
