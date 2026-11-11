import { readFileSync } from 'node:fs';
import { distance } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { normalizeGeometry } from '@/lib/geo/normalize';
import { parsePlotFile } from '@/lib/geo/parse';
import { parseKml } from '@/lib/geo/parse/kml';
import { guessCrs } from '@/lib/geo/reproject';
import { validatePlot } from '@/lib/geo/validate';
import { KOCEVJE_SQUARE } from './fixtures';

const fx = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));
const LJ = [14.505751, 46.049865];

describe('I1: Windows-1250 CSV from Slovenian Excel', () => {
  it('reads headers and names with č/š/ž', async () => {
    const r = await parsePlotFile('parcele.csv', fx('plots-cp1250.csv'));
    expect(r.issues).toEqual([]);
    expect(r.features[0]!.properties.name).toBe('Parcela Žiri');
    expect((r.features[0]!.geometry as GeoJSON.Point).coordinates).toEqual(LJ);
  });
});

describe('I2: KML MultiGeometry / GeometryCollection', () => {
  const sq = KOCEVJE_SQUARE;
  const sq2: GeoJSON.Polygon = { type: 'Polygon', coordinates: [sq.coordinates[0]!.map(([x = 0, y = 0]) => [x + 0.01, y])] };
  it('merges several polygons into a MultiPolygon', () => {
    const r = normalizeGeometry({ type: 'GeometryCollection', geometries: [sq, sq2] });
    expect(r.geometry?.type).toBe('MultiPolygon');
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('merges several points into a MultiPoint', () => {
    const r = normalizeGeometry({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: LJ }, { type: 'Point', coordinates: [14.6, 46.1] }] });
    expect(r.geometry).toEqual({ type: 'MultiPoint', coordinates: [LJ, [14.6, 46.1]] });
  });
  it('drops label points next to a polygon with an info message', () => {
    const r = normalizeGeometry({ type: 'GeometryCollection', geometries: [sq, { type: 'Point', coordinates: [14.8619, 45.6417] }] });
    expect(r.geometry).toEqual(sq);
    expect(r.issues).toEqual([{ code: 'LABEL_POINTS_REMOVED', severity: 'info' }]);
  });
  it('reads a KML Placemark with MultiGeometry', () => {
    const ring = sq.coordinates[0]!.map((p) => p.join(',')).join(' ');
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>P</name><MultiGeometry>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      <Point><coordinates>14.861900,45.641700</coordinates></Point></MultiGeometry></Placemark></kml>`;
    const f = parseKml(kml).features[0]!;
    expect(validatePlot({ geometry: f.geometry, country: 'SI', decimals: f.decimals }).status).toBe('valid');
  });
});

describe('I3: metre data without CRS must be confirmed', () => {
  it('CRS_GUESSED is an error that lists D48/GK as an alternative', () => {
    const r = guessCrs({ type: 'Point', coordinates: [462000, 101000] });
    expect(r.issue).toMatchObject({ code: 'CRS_GUESSED', severity: 'error', params: { crs: 'EPSG:3794', alternatives: 'EPSG:3912' } });
  });
  it('an explicit CRS confirmed by the user overrides the guess', async () => {
    const r = await parsePlotFile('parcele.zip', fx('plots-d96-noprj.zip'), { crs: 'EPSG:3794' });
    expect(r.crsIssue).toBeNull();
    expect(r.detectedCrs).toBe('EPSG:3794');
  });
});

describe('I4: hole outside the outer ring', () => {
  it('is an error', () => {
    const shell = [[14.5, 46.0], [14.51, 46.0], [14.51, 46.01], [14.5, 46.01], [14.5, 46.0]];
    const hole = [[14.6, 46.0], [14.6, 46.01], [14.61, 46.01], [14.61, 46.0], [14.6, 46.0]];
    const r = validatePlot({ geometry: { type: 'Polygon', coordinates: [shell, hole] }, country: 'SI', decimals: null });
    expect(r.status).toBe('error');
    expect(r.issues.map((i) => i.code)).toContain('POLYGON_HOLE_OUTSIDE');
  });
  it('a hole inside the shell is fine', () => {
    const shell = [[14.5, 46.0], [14.51, 46.0], [14.51, 46.01], [14.5, 46.01], [14.5, 46.0]];
    const hole = [[14.502, 46.002], [14.502, 46.004], [14.504, 46.004], [14.504, 46.002], [14.502, 46.002]];
    const r = validatePlot({ geometry: { type: 'Polygon', coordinates: [shell, hole] }, country: 'SI', decimals: null });
    expect(r.status).toBe('valid');
  });
});

describe('I5: Slovenian surveying axis convention in CSV', () => {
  it('reads y;x (Y = easting, X = northing) D96 metres correctly', async () => {
    const r = await parsePlotFile('p.csv', fx('plots-d96-yx.csv'));
    const p = r.features[0]!.geometry as GeoJSON.Point;
    expect(distance(p.coordinates, LJ, { units: 'meters' })).toBeLessThan(1);
    expect(r.crsIssue?.code).toBe('CRS_GUESSED');
  });
  it('reads e;n columns', async () => {
    const r = await parsePlotFile('p.csv', fx('plots-d96-en.csv'));
    const p = r.features[0]!.geometry as GeoJSON.Point;
    expect(distance(p.coordinates, LJ, { units: 'meters' })).toBeLessThan(1);
  });
});
