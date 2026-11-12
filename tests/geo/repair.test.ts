import { kinks } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { describe, expect, it } from 'vitest';
import { repairSelfIntersections, simplifyToFit } from '@/lib/geo/repair';

// A "bow tie": the outline crosses itself in the middle.
const bowTie: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[14.5, 46.0], [14.502, 46.002], [14.502, 46.0], [14.5, 46.002], [14.5, 46.0]]] };
const square: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[14.5, 46.0], [14.502, 46.0], [14.502, 46.002], [14.5, 46.002], [14.5, 46.0]]] };

describe('repairSelfIntersections', () => {
  it('splits a bow tie into simple polygons', () => {
    expect(kinks(bowTie).features.length).toBeGreaterThan(0);
    const { geometry, changed } = repairSelfIntersections(bowTie);
    expect(changed).toBe(true);
    expect(geometry.type).toBe('MultiPolygon');
    expect((geometry as GeoJSON.MultiPolygon).coordinates).toHaveLength(2);
    for (const rings of (geometry as GeoJSON.MultiPolygon).coordinates) {
      expect(kinks({ type: 'Polygon', coordinates: rings }).features).toHaveLength(0);
    }
  });
  it('leaves valid polygons and points alone', () => {
    expect(repairSelfIntersections(square)).toEqual({ geometry: square, changed: false });
    const point: GeoJSON.Point = { type: 'Point', coordinates: [14.5, 46] };
    expect(repairSelfIntersections(point).changed).toBe(false);
  });
});

describe('simplifyToFit', () => {
  // A circle with 2,000 vertices (~100 m radius).
  const circle: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [
      Array.from({ length: 2001 }, (_, i) => {
        const a = ((i % 2000) / 2000) * 2 * Math.PI;
        return [14.5 + 0.0013 * Math.cos(a), 46 + 0.0009 * Math.sin(a)];
      }),
    ],
  };
  const size = (gs: GeoJSON.Geometry[]) => JSON.stringify(gs).length;

  it('returns the input when it already fits', () => {
    expect(simplifyToFit([square], 10_000, size)?.tolerance).toBe(0);
  });
  it('simplifies until the size fits', () => {
    const max = size([circle]) / 4;
    const r = simplifyToFit([circle], max, size)!;
    expect(r.tolerance).toBeGreaterThan(0);
    expect(size(r.geometries)).toBeLessThanOrEqual(max);
    expect(r.verticesAfter).toBeLessThan(r.verticesBefore);
  });
  it('gives up when the limit is impossible', () => {
    expect(simplifyToFit([circle], 10, size)).toBeNull();
  });
});
