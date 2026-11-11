import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { validatePlot } from '@/lib/geo/validate';
import { BOW_TIE, KOCEVJE_SQUARE } from './fixtures';

const codes = (r: ReturnType<typeof validatePlot>) => r.issues.map((i) => i.code);
const LJ: GeoJSON.Point = { type: 'Point', coordinates: [14.505751, 46.049865] };

describe('validatePlot (spec §9 real cases)', () => {
  it('valid polygon with 6 decimals → valid, area computed', () => {
    const r = validatePlot({ geometry: KOCEVJE_SQUARE, country: 'SI' });
    expect(r.status).toBe('valid');
    expect(r.areaHa).toBeGreaterThan(0.9);
    expect(r.areaHa).toBeLessThan(1.1);
  });
  it('self-intersecting polygon → error', () => {
    const r = validatePlot({ geometry: BOW_TIE, country: 'SI', decimals: null });
    expect(r.status).toBe('error');
    expect(codes(r)).toContain('POLYGON_SELF_INTERSECTION');
  });
  it('5 decimals everywhere → error PRECISION_TOO_LOW', () => {
    const r = validatePlot({ geometry: { type: 'Point', coordinates: [14.50575, 46.04986] }, country: 'SI', declaredAreaHa: 1 });
    expect(r.status).toBe('error');
    expect(codes(r)).toContain('PRECISION_TOO_LOW');
  });
  it('5 ha plot as a point → error POINT_OVER_4HA', () => {
    const r = validatePlot({ geometry: LJ, country: 'SI', declaredAreaHa: 5 });
    expect(r.status).toBe('error');
    expect(codes(r)).toContain('POINT_OVER_4HA');
    expect(r.areaHa).toBe(5);
  });
  it('3 ha point → warning', () => {
    const r = validatePlot({ geometry: LJ, country: 'SI', declaredAreaHa: 3 });
    expect(r.status).toBe('warning');
    expect(codes(r)).toEqual(['POINT_POLYGON_RECOMMENDED']);
  });
  it('no geometry → warning NO_GEOMETRY', () => {
    const r = validatePlot({ geometry: null, country: 'SI' });
    expect(r).toEqual({ status: 'warning', issues: [{ code: 'NO_GEOMETRY', severity: 'warning' }], geometry: null, areaHa: null });
  });
  it('swapped coordinates stop further checks', () => {
    const r = validatePlot({ geometry: { type: 'Point', coordinates: [46.049865, 14.505751] }, country: 'SI', declaredAreaHa: 1 });
    expect(codes(r)).toEqual(['COORD_SWAPPED']);
    expect(r.geometry).toBeNull();
  });
  it('explicit decimals null skips the precision check', () => {
    const r = validatePlot({ geometry: { type: 'Point', coordinates: [14.5, 46.0] }, country: 'SI', declaredAreaHa: 1, decimals: null });
    expect(codes(r)).not.toContain('PRECISION_TOO_LOW');
  });
  it('flags duplicates of other plots', () => {
    const r = validatePlot({ geometry: KOCEVJE_SQUARE, country: 'SI', others: [{ id: 'x1', geometry: KOCEVJE_SQUARE }] });
    expect(r.issues).toContainEqual({ code: 'DUPLICATE_PLOT', severity: 'warning', params: { ids: 'x1' } });
  });
  it('plot outside declared country → error', () => {
    expect(validatePlot({ geometry: KOCEVJE_SQUARE, country: 'RS' }).status).toBe('error');
  });
});
