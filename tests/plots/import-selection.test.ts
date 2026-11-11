import { describe, expect, it } from 'vitest';
import type { ParsedFeature } from '@/lib/geo/types';
import { previewImport, selectImportRows } from '@/lib/plots/import-selection';
import { BOW_TIE, KOCEVJE_SQUARE } from '../geo/fixtures';

const f = (geometry: ParsedFeature['geometry'], properties: Record<string, unknown> = {}): ParsedFeature => ({
  geometry,
  properties,
  decimals: { min: 6, max: 6 },
});

describe('previewImport', () => {
  it('takes the label from common property names and falls back to a numbered name', () => {
    const p = previewImport([f(KOCEVJE_SQUARE, { ime: 'Gozd 1' }), f(KOCEVJE_SQUARE, { ProductionPlace: 'Gozd 2' }), f(KOCEVJE_SQUARE, { Name: 'Gozd 3' }), f(KOCEVJE_SQUARE)], 'SI', 'Parcela');
    expect(p.items.map((i) => i.label)).toEqual(['Gozd 1', 'Gozd 2', 'Gozd 3', 'Parcela 4']);
  });
  it('reads the declared area of points and counts statuses', () => {
    const p = previewImport(
      [f({ type: 'Point', coordinates: [14.505751, 46.049865] }, { name: 'T', areaHa: 2 }), f(BOW_TIE, { name: 'B' }), f(KOCEVJE_SQUARE, { name: 'V' })],
      'SI',
      'Parcela',
    );
    expect(p.items[0]!.declaredAreaHa).toBe(2);
    expect(p.counts).toEqual({ valid: 1, warning: 1, error: 1 });
  });
  it('flags duplicates inside the same file', () => {
    const p = previewImport([f(KOCEVJE_SQUARE, { name: 'A' }), f(KOCEVJE_SQUARE, { name: 'A2' })], 'SI', 'Parcela');
    expect(p.items[1]!.issues.map((i) => i.code)).toContain('DUPLICATE_PLOT');
  });
});

describe('selectImportRows', () => {
  const p = previewImport([f(KOCEVJE_SQUARE, { name: 'V' }), f(BOW_TIE, { name: 'B' })], 'SI', 'Parcela');
  it('leaves out plots with errors by default', () => {
    expect(selectImportRows(p.items, false).map((r) => r.label)).toEqual(['V']);
  });
  it('includes them when asked', () => {
    expect(selectImportRows(p.items, true).map((r) => r.label)).toEqual(['V', 'B']);
  });
  it('sends the original geometry and decimals for server-side validation', () => {
    const [row] = selectImportRows(p.items, false);
    expect(row).toMatchObject({ geometry: KOCEVJE_SQUARE, decimals: { min: 6, max: 6 } });
  });
});
