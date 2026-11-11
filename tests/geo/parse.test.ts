import { readFileSync } from 'node:fs';
import { distance } from '@turf/turf';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { parseCsv } from '@/lib/geo/parse/csv';
import { parseGeoJson } from '@/lib/geo/parse/geojson';
import { parsePlotFile } from '@/lib/geo/parse';
import { parseKml, parseKmz } from '@/lib/geo/parse/kml';
import { parseShapefileZip } from '@/lib/geo/parse/shapefile';

const fx = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
const text = (name: string) => fx(name).toString('utf8');
const LJ = [14.505751, 46.049865];
const KOCEVJE_SW = [14.861234, 45.641234];

describe('parseGeoJson', () => {
  it('reprojects a D96/TM FeatureCollection with a crs member', () => {
    const r = parseGeoJson(text('plots-d96.geojson'));
    expect(r.detectedCrs).toBe('EPSG:3794');
    expect(r.crsIssue).toBeNull();
    const p = r.features[0]!.geometry as GeoJSON.Point;
    expect(distance(p.coordinates, LJ, { units: 'meters' })).toBeLessThan(1);
    expect(r.features[0]!.properties.ime).toBe('Parcela LJ');
    expect(r.features[0]!.decimals).toBeNull();
  });
  it('accepts a bare geometry and measures decimals from the raw text', () => {
    const r = parseGeoJson('{"type":"Point","coordinates":[14.505750,46.049860]}');
    expect(r.features).toHaveLength(1);
    expect(r.features[0]!.decimals).toEqual({ min: 6, max: 6 });
  });
  it('reports invalid JSON', () => {
    expect(parseGeoJson('{nope').issues[0]?.code).toBe('PARSE_FAILED');
  });
});

describe('parseCsv', () => {
  it('reads Slovenian Excel CSV with ; and decimal comma', () => {
    const r = parseCsv(text('plots-sl.csv'));
    expect(r.issues).toEqual([]);
    expect(r.features).toHaveLength(1);
    const f = r.features[0]!;
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [14.505751, 46.049865] });
    expect(f.properties.name).toBe('Parcela 1');
    expect(f.properties.areaHa).toBe(2.5);
    expect(f.decimals?.min).toBe(6);
  });
  it('reads English CSV with , separator', () => {
    const r = parseCsv(text('plots-en.csv'));
    expect(r.features.map((f) => (f.geometry as GeoJSON.Point).coordinates)).toEqual([KOCEVJE_SW, [14.862514, 45.642134]]);
  });
  it('reports rows without coordinates', () => {
    const r = parseCsv(text('plots-broken.csv'));
    expect(r.features).toHaveLength(1);
    expect(r.issues).toEqual([{ code: 'PARSE_FAILED', severity: 'error', params: { row: 3 } }]);
  });
});

describe('KML / KMZ', () => {
  it('reads a polygon and a point from KML', () => {
    const r = parseKml(text('plots.kml'));
    expect(r.features.map((f) => f.geometry?.type)).toEqual(['Polygon', 'Point']);
    expect(r.features[0]!.properties.name).toBe('Parcela Kočevje');
    expect(r.features[0]!.decimals).toEqual({ min: 6, max: 6 });
  });
  it('reads the same data from KMZ', async () => {
    const zip = new JSZip();
    zip.file('doc.kml', text('plots.kml'));
    const kmz = await zip.generateAsync({ type: 'uint8array' });
    const r = await parseKmz(kmz);
    expect(r.features.map((f) => f.geometry)).toEqual(parseKml(text('plots.kml')).features.map((f) => f.geometry));
  });
});

describe('parseShapefileZip', () => {
  it('reads a WGS-84 shapefile with .prj', async () => {
    const r = await parseShapefileZip(new Uint8Array(fx('plots-wgs84.zip')));
    expect(r.crsIssue).toBeNull();
    expect(r.detectedCrs).toBe('EPSG:4326');
    expect(r.features[0]!.properties.ime).toBe('Parcela 1');
    const ring = (r.features[0]!.geometry as GeoJSON.Polygon).coordinates[0]!;
    expect(ring).toContainEqual(KOCEVJE_SW);
  });
  it('reads a D96/TM shapefile with .prj', async () => {
    const r = await parseShapefileZip(new Uint8Array(fx('plots-d96.zip')));
    expect(r.detectedCrs).toBe('EPSG:3794');
    expect(r.crsIssue).toBeNull();
  });
  it('guesses D96/TM for a shapefile without .prj and asks for confirmation', async () => {
    const r = await parseShapefileZip(new Uint8Array(fx('plots-d96-noprj.zip')));
    expect(r.crsIssue?.code).toBe('CRS_GUESSED');
    const ring = (r.features[0]!.geometry as GeoJSON.Polygon).coordinates[0]!;
    const nearest = Math.min(...ring.map((p) => distance(p, KOCEVJE_SW, { units: 'meters' })));
    expect(nearest).toBeLessThan(1);
  });
});

describe('parsePlotFile', () => {
  it('dispatches by extension', async () => {
    const r = await parsePlotFile('parcele.CSV', new Uint8Array(fx('plots-en.csv')));
    expect(r.features).toHaveLength(2);
  });
  it('rejects unknown file types', async () => {
    const r = await parsePlotFile('x.docx', new Uint8Array([1, 2, 3]));
    expect(r.issues[0]).toMatchObject({ code: 'PARSE_FAILED', severity: 'error' });
  });
});
