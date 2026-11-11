import type { PlotGeometry } from '@/lib/geo/types';

export type DbGeometry = PlotGeometry & { crs: { type: 'name'; properties: { name: 'EPSG:4326' } } };

/** GeoJSON as PostGIS reads it into geometry(Geometry, 4326): the crs member sets the SRID. */
export function toDbGeometry(geometry: PlotGeometry): DbGeometry {
  return { ...geometry, crs: { type: 'name', properties: { name: 'EPSG:4326' } } };
}
