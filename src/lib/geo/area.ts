import { area } from '@turf/turf';
import { POINT_MAX_AREA_HA, TRACES_DEFAULT_POINT_AREA_HA } from '@/lib/eudr/rules';
import type { Issue, PlotGeometry } from './types';

const MIN_POLYGON_AREA_HA = 0.0001;

/** Geodesic area in hectares (4 decimals); null for point geometries. */
export function computeAreaHa(geometry: PlotGeometry): number | null {
  if (geometry.type === 'Point' || geometry.type === 'MultiPoint') return null;
  return Math.round((area(geometry) / 10_000) * 10_000) / 10_000;
}

export function checkArea(geometry: PlotGeometry, declaredAreaHa: number | undefined): Issue[] {
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    const ha = area(geometry) / 10_000;
    return ha < MIN_POLYGON_AREA_HA ? [{ code: 'AREA_ZERO', severity: 'error' }] : [];
  }
  if (declaredAreaHa === undefined) {
    return [{ code: 'POINT_AREA_MISSING', severity: 'warning', params: { defaultHa: TRACES_DEFAULT_POINT_AREA_HA } }];
  }
  if (declaredAreaHa > POINT_MAX_AREA_HA) {
    return [{ code: 'POINT_OVER_4HA', severity: 'error', params: { areaHa: declaredAreaHa, maxHa: POINT_MAX_AREA_HA } }];
  }
  return [{ code: 'POINT_POLYGON_RECOMMENDED', severity: 'warning' }];
}
