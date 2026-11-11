import type * as GeoJSON from 'geojson';
import { allPositions } from '../coords';
import { countDecimals, decimalStatsFromNumbers } from '../precision';
import type { DecimalStats } from '../types';
import { failed, finalize, type ParseResult, type RawFeature } from './common';

type Reviver = (key: string, value: unknown) => unknown;

/**
 * Parse JSON while remembering how many decimals each coordinate had in the source text
 * (JSON.parse source access; falls back to the parsed numbers when unavailable).
 */
function parseWithDecimals(text: string): { value: unknown; decimalsOf: (pos: GeoJSON.Position) => number[] | undefined } {
  const seen = new WeakMap<object, number[]>();
  const reviver = function (this: unknown, key: string, value: unknown, context?: { source?: string }): unknown {
    if (typeof value === 'number' && Array.isArray(this) && context?.source !== undefined) {
      const list = seen.get(this) ?? [];
      list[Number(key)] = countDecimals(context.source);
      seen.set(this, list);
    }
    return value;
  };
  const value: unknown = JSON.parse(text, reviver as Reviver);
  return { value, decimalsOf: (pos) => seen.get(pos) };
}

function statsFor(geometry: GeoJSON.Geometry, decimalsOf: (pos: GeoJSON.Position) => number[] | undefined): DecimalStats | null {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const pos of allPositions(geometry)) {
    const d = decimalsOf(pos);
    if (!d) return decimalStatsFromNumbers(geometry);
    for (const v of d.slice(0, 2)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseGeoJson(text: string): ParseResult {
  let parsed: ReturnType<typeof parseWithDecimals>;
  try {
    parsed = parseWithDecimals(text);
  } catch {
    return failed();
  }
  const root = parsed.value;
  if (!isObject(root) || typeof root.type !== 'string') return failed();

  let features: GeoJSON.Feature[];
  if (root.type === 'FeatureCollection' && Array.isArray(root.features)) features = root.features as GeoJSON.Feature[];
  else if (root.type === 'Feature') features = [root as unknown as GeoJSON.Feature];
  else features = [{ type: 'Feature', properties: {}, geometry: root as unknown as GeoJSON.Geometry }];

  const crsMember = isObject(root.crs) && isObject(root.crs.properties) ? root.crs.properties.name : undefined;
  const raw: RawFeature[] = features.map((f) => ({
    geometry: f.geometry ?? null,
    properties: isObject(f.properties) ? f.properties : {},
    decimals: f.geometry ? statsFor(f.geometry, parsed.decimalsOf) : null,
  }));
  return finalize(raw, typeof crsMember === 'string' ? crsMember : null);
}
