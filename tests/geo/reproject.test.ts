import { distance } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { guessCrs, parseCrsHint, toWgs84, type SupportedCrs } from '@/lib/geo/reproject';
import refs from '../fixtures/reference-points.json';

const BESSEL: readonly string[] = ['EPSG:3912', 'EPSG:3908', 'EPSG:3909', 'EPSG:31276', 'EPSG:31277'];

describe('toWgs84 against pyproj reference points', () => {
  for (const r of refs) {
    const tolerance = BESSEL.includes(r.crs) ? 3 : 1;
    it(`${r.name} (${r.crs}) within ${tolerance} m`, () => {
      const out = toWgs84({ type: 'Point', coordinates: [r.x, r.y] }, r.crs as SupportedCrs) as GeoJSON.Point;
      const meters = distance(out.coordinates, [r.lon, r.lat], { units: 'meters' });
      expect(meters).toBeLessThan(tolerance);
    });
  }
  it('accepts a country hint for MGI 1901 data and stays within 3 m', () => {
    for (const name of ['Sombor', 'Novi Sad']) {
      const r = refs.find((x) => x.name === name)!;
      const out = toWgs84({ type: 'Point', coordinates: [r.x, r.y] }, r.crs as SupportedCrs, { country: 'RS' }) as GeoJSON.Point;
      expect(distance(out.coordinates, [r.lon, r.lat], { units: 'meters' })).toBeLessThan(3);
    }
  });
  it('leaves EPSG:4326 untouched', () => {
    const p: GeoJSON.Point = { type: 'Point', coordinates: [14.505751, 46.049865] };
    expect(toWgs84(p, 'EPSG:4326')).toEqual(p);
  });
});

describe('parseCrsHint', () => {
  it.each([
    ['EPSG:3794', 'EPSG:3794'],
    ['urn:ogc:def:crs:EPSG::3794', 'EPSG:3794'],
    ['urn:ogc:def:crs:OGC:1.3:CRS84', 'EPSG:4326'],
    ['EPSG:4326', 'EPSG:4326'],
    ['PROJCS["Slovenia_1996_Slovene_National_Grid",GEOGCS["GCS_Slovenia_1996"]]', 'EPSG:3794'],
    ['PROJCS["D96_TM"]', 'EPSG:3794'],
    ['PROJCS["MGI_Slovenia_Grid"]', 'EPSG:3912'],
    ['PROJCS["D48_GK"]', 'EPSG:3912'],
    ['PROJCS["HTRS96_Croatia_TM"]', 'EPSG:3765'],
    ['PROJCS["MGI_Balkans_6"]', 'EPSG:31276'],
    ['PROJCS["MGI_1901_Balkans_zone_6"]', 'EPSG:3908'],
    ['EPSG:3909', 'EPSG:3909'],
    ['PROJCS["MGI / Balkans zone 7"]', 'EPSG:31277'],
    ['PROJCS["WGS_1984_UTM_Zone_33N"]', 'EPSG:32633'],
    ['PROJCS["WGS 84 / UTM zone 34N"]', 'EPSG:32634'],
    ['GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]', 'EPSG:4326'],
  ])('%s → %s', (hint, expected) => {
    expect(parseCrsHint(hint)).toBe(expected);
  });
  it('returns null for unknown', () => expect(parseCrsHint('EPSG:2056')).toBeNull());
});

describe('guessCrs', () => {
  it('guesses D96/TM for metre values in Slovenia and asks for confirmation', () => {
    const r = guessCrs({ type: 'Point', coordinates: [461752.091, 101237.118] });
    expect(r.crs).toBe('EPSG:3794');
    expect(r.issue?.code).toBe('CRS_GUESSED');
    expect(r.issue?.severity).toBe('error');
    expect(r.issue?.params?.crs).toBe('EPSG:3794');
  });
  it('accepts degrees as WGS-84 without an issue', () => {
    expect(guessCrs({ type: 'Point', coordinates: [14.505751, 46.049865] })).toEqual({ crs: 'EPSG:4326', issue: null });
  });
  it('reports unknown metre values', () => {
    const r = guessCrs({ type: 'Point', coordinates: [2600000, 1200000] });
    expect(r.issue?.code).toBe('CRS_UNKNOWN');
    expect(r.issue?.severity).toBe('error');
  });
});
