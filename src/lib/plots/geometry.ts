import type * as GeoJSON from 'geojson';

/** Geometry read from PostGIS (jsonb cast) without its crs member, or null. */
export function geometryFromDb(value: unknown): GeoJSON.Geometry | null {
  if (!value || typeof value !== 'object' || !('type' in value)) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { crs, ...geometry } = value as GeoJSON.Geometry & { crs?: unknown };
  return geometry as GeoJSON.Geometry;
}
