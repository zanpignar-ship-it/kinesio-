import { destination, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { checkArea, computeAreaHa } from '@/lib/geo/area';

function square100m(): GeoJSON.Polygon {
  const o = point([14.8, 45.6]);
  const e = destination(o, 0.1, 90, { units: 'kilometers' });
  const ne = destination(e, 0.1, 0, { units: 'kilometers' });
  const n = destination(o, 0.1, 0, { units: 'kilometers' });
  const c = [o, e, ne, n].map((f) => f.geometry.coordinates);
  return { type: 'Polygon', coordinates: [[...c, c[0]!]] };
}

const pt: GeoJSON.Point = { type: 'Point', coordinates: [14.505751, 46.049865] };
const codes = (issues: ReturnType<typeof checkArea>) => issues.map((i) => i.code);

describe('computeAreaHa', () => {
  it('computes ~1 ha for a 100 m square', () => {
    const a = computeAreaHa(square100m());
    expect(a).not.toBeNull();
    expect(a!).toBeGreaterThanOrEqual(0.99);
    expect(a!).toBeLessThanOrEqual(1.01);
  });
  it('returns null for points', () => expect(computeAreaHa(pt)).toBeNull());
});

describe('checkArea', () => {
  it('rejects a 5 ha plot given as a point', () => {
    const issues = checkArea(pt, 5);
    expect(codes(issues)).toEqual(['POINT_OVER_4HA']);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.params?.areaHa).toBe(5);
  });
  it('only recommends a polygon for a 3 ha point', () => {
    const issues = checkArea(pt, 3);
    expect(issues.map((i) => [i.code, i.severity])).toEqual([['POINT_POLYGON_RECOMMENDED', 'warning']]);
  });
  it('accepts exactly 4 ha as a point', () => expect(codes(checkArea(pt, 4))).toEqual(['POINT_POLYGON_RECOMMENDED']));
  it('warns when a point has no area', () => {
    const issues = checkArea(pt, undefined);
    expect(codes(issues)).toEqual(['POINT_AREA_MISSING']);
    expect(issues[0]?.params?.defaultHa).toBe(4);
  });
  it('rejects a degenerate polygon', () => {
    const line: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[14.8, 45.6], [14.81, 45.6], [14.82, 45.6], [14.8, 45.6]]] };
    expect(codes(checkArea(line, undefined))).toEqual(['AREA_ZERO']);
  });
  it('accepts a normal polygon', () => expect(checkArea(square100m(), undefined)).toEqual([]));
});
