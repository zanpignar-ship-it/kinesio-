import type * as GeoJSON from 'geojson';

/** All positions of a geometry, flattened (GeometryCollection included). */
export function allPositions(geometry: GeoJSON.Geometry): GeoJSON.Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(allPositions);
  }
}

/** Rebuild a geometry with every position mapped through `fn`. */
export function mapPositions<G extends GeoJSON.Geometry>(geometry: G, fn: (p: GeoJSON.Position) => GeoJSON.Position): G {
  const g: GeoJSON.Geometry = geometry;
  switch (g.type) {
    case 'Point':
      return { ...g, coordinates: fn(g.coordinates) } as G;
    case 'MultiPoint':
    case 'LineString':
      return { ...g, coordinates: g.coordinates.map(fn) } as G;
    case 'MultiLineString':
    case 'Polygon':
      return { ...g, coordinates: g.coordinates.map((r) => r.map(fn)) } as G;
    case 'MultiPolygon':
      return { ...g, coordinates: g.coordinates.map((p) => p.map((r) => r.map(fn))) } as G;
    case 'GeometryCollection':
      return { ...g, geometries: g.geometries.map((x) => mapPositions(x, fn)) } as G;
  }
}
