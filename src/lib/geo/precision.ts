import type * as GeoJSON from 'geojson';
import { MIN_COORD_DECIMALS } from '@/lib/eudr/rules';
import { allPositions } from './coords';
import type { DecimalStats, Issue } from './types';

/** Rough bounding boxes [minLon, minLat, maxLon, maxLat] used to detect swapped coordinates. */
export const COUNTRY_BBOX: Readonly<Record<string, readonly [number, number, number, number]>> = {
  SI: [13.3, 45.4, 16.7, 46.9],
  HR: [13.4, 42.3, 19.5, 46.6],
  BA: [15.7, 42.5, 19.7, 45.3],
  RS: [18.8, 41.8, 23.1, 46.2],
};

/** Number of decimal digits as written (string) or in the shortest representation (number). */
export function countDecimals(raw: string | number): number {
  const text = (typeof raw === 'number' ? String(raw) : raw).trim().toLowerCase();
  const [mantissa = '', exponent] = text.split('e');
  const sep = Math.max(mantissa.lastIndexOf('.'), mantissa.lastIndexOf(','));
  const mantissaDecimals = sep === -1 ? 0 : mantissa.length - sep - 1;
  const exp = exponent === undefined ? 0 : Number.parseInt(exponent, 10);
  return Math.max(0, mantissaDecimals - (Number.isNaN(exp) ? 0 : exp));
}

export function decimalStatsFromNumbers(geometry: GeoJSON.Geometry): DecimalStats | null {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  let seen = false;
  for (const pos of allPositions(geometry)) {
    for (const v of pos.slice(0, 2)) {
      const d = countDecimals(v);
      min = Math.min(min, d);
      max = Math.max(max, d);
      seen = true;
    }
  }
  return seen ? { min, max } : null;
}

export function checkPrecision(stats: DecimalStats | null): Issue[] {
  if (!stats) return [];
  if (stats.max < MIN_COORD_DECIMALS) {
    return [{ code: 'PRECISION_TOO_LOW', severity: 'error', params: { found: stats.max, required: MIN_COORD_DECIMALS } }];
  }
  if (stats.min < MIN_COORD_DECIMALS) {
    return [{ code: 'PRECISION_PARTIAL', severity: 'warning', params: { found: stats.min, required: MIN_COORD_DECIMALS } }];
  }
  return [];
}

function inBox(lon: number, lat: number, box: readonly [number, number, number, number]): boolean {
  return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
}

export function checkCoordinateRanges(geometry: GeoJSON.Geometry, country?: string): Issue[] {
  const positions = allPositions(geometry);
  if (positions.length === 0) return [];
  if (positions.some(([x = 0, y = 0]) => Math.abs(x) > 1000 || Math.abs(y) > 1000)) {
    return [{ code: 'COORD_LOOKS_PROJECTED', severity: 'error' }];
  }
  if (positions.some(([x = 0, y = 0]) => Math.abs(x) > 180 || Math.abs(y) > 90)) {
    return [{ code: 'COORD_OUT_OF_RANGE', severity: 'error' }];
  }
  const box = country ? COUNTRY_BBOX[country] : undefined;
  if (box) {
    const noneInside = positions.every(([x = 0, y = 0]) => !inBox(x, y, box));
    const allSwappedInside = positions.every(([x = 0, y = 0]) => inBox(y, x, box));
    if (noneInside && allSwappedInside) return [{ code: 'COORD_SWAPPED', severity: 'error' }];
  }
  return [];
}
