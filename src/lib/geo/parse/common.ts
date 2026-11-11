import type * as GeoJSON from 'geojson';
import { mapPositions } from '../coords';
import { guessCrs, parseCrsHint, sloveneGridAxesSwapped, toWgs84, type SupportedCrs } from '../reproject';
import type { DecimalStats, Issue, ParsedFeature } from '../types';

export interface ParseResult {
  /** Geometries already in WGS-84. */
  features: ParsedFeature[];
  detectedCrs: SupportedCrs;
  crsIssue: Issue | null;
  issues: Issue[];
}

export interface RawFeature {
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, unknown>;
  /** Decimals measured on the source text, when available. */
  decimals: DecimalStats | null;
}

export function failed(params?: Record<string, string | number>): ParseResult {
  const issue: Issue = params ? { code: 'PARSE_FAILED', severity: 'error', params } : { code: 'PARSE_FAILED', severity: 'error' };
  return { features: [], detectedCrs: 'EPSG:4326', crsIssue: null, issues: [issue] };
}

/** Decide the CRS (explicit hint, else guess), reproject to WGS-84 and assemble the result. */
export interface FinalizeOptions {
  /** CRS confirmed by the user; overrides the hint and the guess. */
  crs?: SupportedCrs;
}

export function finalize(raw: RawFeature[], crsHint: string | null, issues: Issue[] = [], opts: FinalizeOptions = {}): ParseResult {
  const geometries = raw.flatMap((f) => (f.geometry ? [f.geometry] : []));
  if (raw.length === 0) return { ...failed(), issues: [...issues, ...failed().issues] };

  let crs: SupportedCrs;
  let crsIssue: Issue | null = null;
  const fromHint = crsHint ? parseCrsHint(crsHint) : null;
  if (opts.crs) {
    crs = opts.crs;
  } else if (crsHint && !fromHint) {
    crs = 'EPSG:4326';
    crsIssue = { code: 'CRS_UNKNOWN', severity: 'error', params: { crs: crsHint.slice(0, 80) } };
  } else if (fromHint) {
    crs = fromHint;
  } else {
    const guess = guessCrs({ type: 'GeometryCollection', geometries });
    crs = guess.crs;
    crsIssue = guess.issue;
  }

  const sloveneGrid = crs === 'EPSG:3794' || crs === 'EPSG:3912';
  const swap = sloveneGrid && sloveneGridAxesSwapped({ type: 'GeometryCollection', geometries });
  const features: ParsedFeature[] = raw.map((f) => ({
    geometry: f.geometry ? toWgs84(swap ? mapPositions(f.geometry, ([x = 0, y = 0, ...z]) => [y, x, ...z]) : f.geometry, crs) : null,
    properties: f.properties,
    decimals: crs === 'EPSG:4326' ? f.decimals : null,
  }));
  return { features, detectedCrs: crs, crsIssue, issues };
}
