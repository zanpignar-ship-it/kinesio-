import { booleanClockwise } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { normalizeGeometry } from '@/lib/geo/normalize';
import { BOW_TIE, KOCEVJE_SQUARE } from './fixtures';

const codes = (r: ReturnType<typeof normalizeGeometry>) => r.issues.map((i) => i.code);

describe('normalizeGeometry', () => {
  it('keeps a valid CCW closed polygon unchanged with no issues', () => {
    const r = normalizeGeometry(KOCEVJE_SQUARE);
    expect(r.issues).toEqual([]);
    expect(r.geometry).toEqual(KOCEVJE_SQUARE);
  });

  it('reports a self-intersection as an error', () => {
    const r = normalizeGeometry(BOW_TIE);
    const issue = r.issues.find((i) => i.code === 'POLYGON_SELF_INTERSECTION');
    expect(issue?.severity).toBe('error');
    expect(issue?.params?.lon).toBeCloseTo(14.805, 6);
    expect(issue?.params?.lat).toBeCloseTo(45.605, 6);
  });

  it('closes an open ring and warns', () => {
    const open: GeoJSON.Polygon = { type: 'Polygon', coordinates: [KOCEVJE_SQUARE.coordinates[0]!.slice(0, 4)] };
    const r = normalizeGeometry(open);
    expect(codes(r)).toEqual(['POLYGON_CLOSED_AUTOMATICALLY']);
    expect(r.geometry).toEqual(KOCEVJE_SQUARE);
  });

  it('rejects a ring with fewer than 4 positions', () => {
    const tri: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[14.8, 45.6], [14.81, 45.6], [14.8, 45.6]]] };
    expect(codes(normalizeGeometry(tri))).toContain('POLYGON_TOO_FEW_POINTS');
  });

  it('rewinds a clockwise ring to CCW', () => {
    const cw: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[...KOCEVJE_SQUARE.coordinates[0]!].reverse()] };
    const r = normalizeGeometry(cw);
    expect(codes(r)).toEqual(['RING_ORIENTATION_FIXED']);
    const ring = (r.geometry as GeoJSON.Polygon).coordinates[0]!;
    expect(booleanClockwise(ring)).toBe(false);
  });

  it('drops a Z coordinate from GPS points', () => {
    const r = normalizeGeometry({ type: 'Point', coordinates: [14.505751, 46.049865, 512.3] });
    expect(r.geometry).toEqual({ type: 'Point', coordinates: [14.505751, 46.049865] });
    expect(r.issues).toEqual([{ code: 'Z_COORDINATE_REMOVED', severity: 'info' }]);
  });

  it('rejects a LineString', () => {
    const r = normalizeGeometry({ type: 'LineString', coordinates: [[14.8, 45.6], [14.9, 45.7]] });
    expect(r.geometry).toBeNull();
    expect(r.issues[0]).toMatchObject({ code: 'GEOM_TYPE_NOT_ALLOWED', severity: 'error', params: { type: 'LineString' } });
  });

  it('unwraps a GeometryCollection with one allowed geometry', () => {
    const r = normalizeGeometry({ type: 'GeometryCollection', geometries: [KOCEVJE_SQUARE] });
    expect(r.geometry).toEqual(KOCEVJE_SQUARE);
  });

  it('reports partIndex for the broken part of a MultiPolygon', () => {
    const r = normalizeGeometry({
      type: 'MultiPolygon',
      coordinates: [KOCEVJE_SQUARE.coordinates, BOW_TIE.coordinates],
    });
    const issue = r.issues.find((i) => i.code === 'POLYGON_SELF_INTERSECTION');
    expect(issue?.partIndex).toBe(1);
  });

  it('removes consecutive duplicate vertices', () => {
    const ring = KOCEVJE_SQUARE.coordinates[0]!;
    const dup: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[ring[0]!, ring[1]!, ring[1]!, ring[2]!, ring[3]!, ring[4]!]] };
    const r = normalizeGeometry(dup);
    expect(r.geometry).toEqual(KOCEVJE_SQUARE);
    expect(r.issues).toEqual([]);
  });
});
