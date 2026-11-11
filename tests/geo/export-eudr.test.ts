import { readFileSync } from 'node:fs';
import { booleanClockwise, circle } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { buildEudrGeoJson, serializeEudrGeoJson, type ExportPlot } from '@/lib/geo/export-eudr';
import { KOCEVJE_SQUARE } from './fixtures';

const golden = JSON.parse(readFileSync(new URL('../fixtures/eudr-export.golden.json', import.meta.url), 'utf8')) as unknown;
const ring = KOCEVJE_SQUARE.coordinates[0]!;

const GOLDEN_INPUT: ExportPlot[] = [
  { label: 'Parcela 1', geometry: { type: 'Point', coordinates: [14.50575123456, 46.0498649999] }, producerName: 'Gozd d.o.o.', producerCountry: 'si', areaHa: 2.5 },
  // same square with extra digits and a vertex that collapses after rounding
  {
    label: 'Parcela 2',
    producerCountry: 'SI',
    areaHa: 1.15,
    geometry: { type: 'Polygon', coordinates: [[ring[0]!, [14.86251401, 45.64123399], [14.8625140001, 45.6412340001], ring[2]!, ring[3]!, ring[4]!]] },
  },
  // clockwise input
  { label: 'Parcela 3', geometry: { type: 'Polygon', coordinates: [[...ring].reverse()] } },
];

describe('buildEudrGeoJson', () => {
  it('matches the golden file', () => {
    expect(buildEudrGeoJson(GOLDEN_INPUT)).toEqual(golden);
  });
  it('produces a FeatureCollection with ProductionPlace on every feature', () => {
    const fc = buildEudrGeoJson(GOLDEN_INPUT);
    expect(fc.type).toBe('FeatureCollection');
    for (const f of fc.features) {
      expect(f.geometry).toBeTruthy();
      expect(typeof f.properties?.ProductionPlace).toBe('string');
    }
  });
  it('never writes more than 6 decimals', () => {
    const { text } = serializeEudrGeoJson(buildEudrGeoJson(GOLDEN_INPUT));
    const coords = text.slice(text.indexOf('coordinates'));
    expect(coords).not.toMatch(/\d\.\d{7,}/);
  });
  it('adds Area only to points', () => {
    const fc = buildEudrGeoJson(GOLDEN_INPUT);
    expect(fc.features[0]!.properties?.Area).toBe(2.5);
    expect(fc.features[1]!.properties).not.toHaveProperty('Area');
  });
  it('rewinds clockwise polygons to counter-clockwise', () => {
    const g = buildEudrGeoJson(GOLDEN_INPUT).features[2]!.geometry as GeoJSON.Polygon;
    expect(booleanClockwise(g.coordinates[0]!)).toBe(false);
  });
  it('omits ProducerName when not given', () => {
    expect(buildEudrGeoJson(GOLDEN_INPUT).features[2]!.properties).not.toHaveProperty('ProducerName');
  });
  it('rounds Area to 4 decimals', () => {
    const fc = buildEudrGeoJson([{ label: 'x', geometry: { type: 'Point', coordinates: [14.5, 46] }, areaHa: 1.234567 }]);
    expect(fc.features[0]!.properties?.Area).toBe(1.2346);
  });
});

describe('serializeEudrGeoJson', () => {
  it('reports size and no issues for a small file', () => {
    const r = serializeEudrGeoJson(buildEudrGeoJson(GOLDEN_INPUT));
    expect(r.issues).toEqual([]);
    expect(r.bytes).toBe(new TextEncoder().encode(r.text).length);
  });
  it('rejects files over 25 MB', () => {
    const plots: ExportPlot[] = Array.from({ length: 300 }, (_, i) => ({
      label: `P${i}`,
      geometry: circle([14.5 + i * 0.01, 46], 0.5, { steps: 5000 }).geometry,
    }));
    const r = serializeEudrGeoJson(buildEudrGeoJson(plots));
    expect(r.bytes).toBeGreaterThan(25 * 1024 * 1024);
    expect(r.issues[0]).toMatchObject({ code: 'EXPORT_TOO_LARGE', severity: 'error', params: { max: 26214400 } });
  }, 30_000);
});
