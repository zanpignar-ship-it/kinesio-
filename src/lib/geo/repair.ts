import { area, featureCollection, polygon as turfPolygon, simplify, unkinkPolygon } from '@turf/turf';
import type * as GeoJSON from 'geojson';

type Poly = GeoJSON.Polygon | GeoJSON.MultiPolygon;

/** Minimum piece kept after splitting a self-intersecting outline (1 m²; slivers from duplicate edges are dropped). */
const MIN_PIECE_M2 = 1;

/**
 * Repair a self-intersecting outline ("bow tie") by splitting it at the crossings into simple polygons.
 * Points and valid polygons are returned unchanged. The result must still be checked by the user on the map.
 */
export function repairSelfIntersections(geometry: GeoJSON.Geometry): { geometry: GeoJSON.Geometry; changed: boolean } {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return { geometry, changed: false };
  const parts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const pieces: GeoJSON.Position[][][] = [];
  let changed = false;
  for (const rings of parts) {
    let split: GeoJSON.Feature<GeoJSON.Polygon>[];
    try {
      split = unkinkPolygon(turfPolygon(rings)).features;
    } catch {
      pieces.push(rings);
      continue;
    }
    if (split.length > 1) changed = true;
    for (const f of split) if (area(f) >= MIN_PIECE_M2) pieces.push(f.geometry.coordinates);
  }
  if (!changed || pieces.length === 0) return { geometry, changed: false };
  const out: Poly = pieces.length === 1 ? { type: 'Polygon', coordinates: pieces[0]! } : { type: 'MultiPolygon', coordinates: pieces };
  return { geometry: out, changed: true };
}

const vertexCount = (g: GeoJSON.Geometry): number =>
  g.type === 'Polygon' ? g.coordinates.flat().length : g.type === 'MultiPolygon' ? g.coordinates.flat(2).length : 1;

/**
 * Simplify polygons until the serialized size fits `maxBytes` (EUDR GeoJSON limit). Tolerances start at
 * ~0.1 m and grow; topology is preserved. Returns null when even ~10 m is not enough.
 */
export function simplifyToFit(
  geometries: GeoJSON.Geometry[],
  maxBytes: number,
  size: (gs: GeoJSON.Geometry[]) => number,
): { geometries: GeoJSON.Geometry[]; tolerance: number; verticesBefore: number; verticesAfter: number } | null {
  const verticesBefore = geometries.reduce((n, g) => n + vertexCount(g), 0);
  if (size(geometries) <= maxBytes) return { geometries, tolerance: 0, verticesBefore, verticesAfter: verticesBefore };
  for (const tolerance of [0.000001, 0.000003, 0.00001, 0.00003, 0.0001]) {
    const out = geometries.map((g) =>
      g.type === 'Polygon' || g.type === 'MultiPolygon'
        ? (simplify(featureCollection([{ type: 'Feature', properties: {}, geometry: g }]), { tolerance, highQuality: true }).features[0]!.geometry as GeoJSON.Geometry)
        : g,
    );
    if (size(out) <= maxBytes) return { geometries: out, tolerance, verticesBefore, verticesAfter: out.reduce((n, g) => n + vertexCount(g), 0) };
  }
  return null;
}
