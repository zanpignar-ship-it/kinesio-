import { describe, expect, it } from 'vitest';
import { importPayloadSchema } from '@/lib/plots/schemas';
import { prepareDrawnPlot } from '@/lib/plots/service';
import { showsAreaField } from '@/lib/plots/area-field';

describe('prepareDrawnPlot', () => {
  it('does not warn about precision for coordinates drawn in the app (trailing zeros dropped)', () => {
    const row = prepareDrawnPlot(
      { label: 'R', country: 'SI', geometry: { type: 'Polygon', coordinates: [[[14.86123, 45.6412], [14.8625, 45.6412], [14.8625, 45.6421], [14.86123, 45.6421], [14.86123, 45.6412]]] } },
      [],
    );
    expect(row.validation_issues.map((i) => i.code)).not.toContain('PRECISION_PARTIAL');
    expect(row.validation_issues.map((i) => i.code)).not.toContain('PRECISION_TOO_LOW');
  });
});

describe('importPayloadSchema', () => {
  const base = { locale: 'sl', country: 'SI', fileName: 'a.csv', filePath: null, detectedCrs: 'EPSG:4326', rows: [{ label: 'A', geometry: { type: 'Point', coordinates: [14.5, 46.0] }, decimals: { min: 6, max: 6 } }] };
  it('accepts a normal payload', () => expect(importPayloadSchema.safeParse(base).success).toBe(true));
  it('turns a bad row value into a dropped field instead of failing everything', () => {
    const r = importPayloadSchema.safeParse({ ...base, rows: [{ label: 42, geometry: null, declaredAreaHa: -5, decimals: null }] });
    expect(r.success).toBe(true);
    expect(r.data?.rows[0]).toMatchObject({ label: '42', declaredAreaHa: undefined });
  });
  it('rejects a file path outside the organization folder', () => {
    const r = importPayloadSchema.safeParse({ ...base, filePath: '../other/x.csv' });
    expect(r.success).toBe(false);
  });
  it('rejects more than 2,000 rows', () => {
    const r = importPayloadSchema.safeParse({ ...base, rows: Array.from({ length: 2001 }, () => base.rows[0]) });
    expect(r.success).toBe(false);
  });
});

describe('showsAreaField', () => {
  it('shows the area for points and multi-points, also when they cannot be redrawn', () => {
    expect(showsAreaField('point', null)).toBe(true);
    expect(showsAreaField('polygon', null)).toBe(false);
    expect(showsAreaField('polygon', 'MultiPoint')).toBe(true);
    expect(showsAreaField('polygon', 'MultiPolygon')).toBe(false);
  });
});
