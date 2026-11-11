import { booleanPointInPolygon, destination, pointToPolygonDistance } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { checkCountry, countryBorder } from '@/lib/geo/country';

const LJUBLJANA: GeoJSON.Point = { type: 'Point', coordinates: [14.505751, 46.049865] };

/** Walk south from Metlika (SI) until the point lies ~100 m outside Slovenia (in Croatia). */
function pointJustOutsideSlovenia(targetMeters: number): GeoJSON.Point {
  const si = countryBorder('SI')!;
  let p: GeoJSON.Position = [15.316, 45.648];
  for (let i = 0; i < 2000; i++) {
    const outside = !booleanPointInPolygon(p, si);
    if (outside && pointToPolygonDistance(p, si, { units: 'meters' }) >= targetMeters) return { type: 'Point', coordinates: p };
    p = destination(p, 10, 180, { units: 'meters' }).geometry.coordinates;
  }
  throw new Error('border not found');
}

describe('checkCountry', () => {
  it('accepts Ljubljana in Slovenia', () => expect(checkCountry(LJUBLJANA, 'SI')).toEqual([]));
  it('rejects Ljubljana declared as Croatia', () => {
    const issues = checkCountry(LJUBLJANA, 'HR');
    expect(issues).toEqual([{ code: 'OUTSIDE_COUNTRY', severity: 'error', params: { country: 'HR' } }]);
  });
  it('tolerates a point 100 m across the SI/HR border', () => {
    expect(checkCountry(pointJustOutsideSlovenia(100), 'SI')).toEqual([]);
  });
  it('rejects a point 500 m across the SI/HR border', () => {
    expect(checkCountry(pointJustOutsideSlovenia(500), 'SI').map((i) => i.code)).toEqual(['OUTSIDE_COUNTRY']);
  });
  it('reports unavailable check for countries without border data', () => {
    expect(checkCountry(LJUBLJANA, 'DE')).toEqual([{ code: 'COUNTRY_CHECK_UNAVAILABLE', severity: 'info', params: { country: 'DE' } }]);
  });
  it('has border data for SI, HR, BA, RS', () => {
    for (const c of ['SI', 'HR', 'BA', 'RS']) expect(countryBorder(c)).not.toBeNull();
  });
});
