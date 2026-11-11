import type * as GeoJSON from 'geojson';

export type Severity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'GEOM_TYPE_NOT_ALLOWED'
  | 'COORD_OUT_OF_RANGE'
  | 'COORD_SWAPPED'
  | 'COORD_LOOKS_PROJECTED'
  | 'PRECISION_TOO_LOW'
  | 'PRECISION_PARTIAL'
  | 'POLYGON_CLOSED_AUTOMATICALLY'
  | 'POLYGON_TOO_FEW_POINTS'
  | 'POLYGON_SELF_INTERSECTION'
  | 'RING_ORIENTATION_FIXED'
  | 'Z_COORDINATE_REMOVED'
  | 'POINT_OVER_4HA'
  | 'POINT_POLYGON_RECOMMENDED'
  | 'POINT_AREA_MISSING'
  | 'OUTSIDE_COUNTRY'
  | 'COUNTRY_CHECK_UNAVAILABLE'
  | 'DUPLICATE_PLOT'
  | 'AREA_ZERO'
  | 'NO_GEOMETRY'
  | 'CRS_GUESSED'
  | 'CRS_UNKNOWN'
  | 'PARSE_FAILED'
  | 'EXPORT_TOO_LARGE';

/** Every issue code, for exhaustiveness checks (e.g. translations). */
export const ALL_ISSUE_CODES: readonly IssueCode[] = [
  'GEOM_TYPE_NOT_ALLOWED',
  'COORD_OUT_OF_RANGE',
  'COORD_SWAPPED',
  'COORD_LOOKS_PROJECTED',
  'PRECISION_TOO_LOW',
  'PRECISION_PARTIAL',
  'POLYGON_CLOSED_AUTOMATICALLY',
  'POLYGON_TOO_FEW_POINTS',
  'POLYGON_SELF_INTERSECTION',
  'RING_ORIENTATION_FIXED',
  'Z_COORDINATE_REMOVED',
  'POINT_OVER_4HA',
  'POINT_POLYGON_RECOMMENDED',
  'POINT_AREA_MISSING',
  'OUTSIDE_COUNTRY',
  'COUNTRY_CHECK_UNAVAILABLE',
  'DUPLICATE_PLOT',
  'AREA_ZERO',
  'NO_GEOMETRY',
  'CRS_GUESSED',
  'CRS_UNKNOWN',
  'PARSE_FAILED',
  'EXPORT_TOO_LARGE',
];

export interface Issue {
  code: IssueCode;
  severity: Severity;
  params?: Record<string, string | number>;
  /** Index of the part (MultiPolygon/MultiPoint) the issue refers to. */
  partIndex?: number;
}

export type PlotGeometry = GeoJSON.Point | GeoJSON.MultiPoint | GeoJSON.Polygon | GeoJSON.MultiPolygon;

/** Smallest and largest number of decimal digits across all coordinates. */
export interface DecimalStats {
  min: number;
  max: number;
}

export interface ParsedFeature {
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, unknown>;
  decimals: DecimalStats | null;
}

export type PlotStatus = 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: PlotStatus;
  issues: Issue[];
  geometry: PlotGeometry | null;
  areaHa: number | null;
}

export function statusFromIssues(issues: Issue[]): PlotStatus {
  if (issues.some((i) => i.severity === 'error')) return 'error';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'valid';
}
