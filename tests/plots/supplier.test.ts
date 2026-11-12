import { describe, expect, it } from 'vitest';
import { importPayloadSchema, plotFormSchema } from '@/lib/plots/schemas';

const id = '0b6f2c8e-6d1a-4c55-9b7e-2f1d0b5f9a11';

describe('supplier on plots', () => {
  it('is optional in the plot form; an empty choice means no supplier', () => {
    expect(plotFormSchema.parse({ label: 'P', country: 'SI', supplierId: '' }).supplierId).toBeUndefined();
    expect(plotFormSchema.parse({ label: 'P', country: 'SI', supplierId: id }).supplierId).toBe(id);
    expect(plotFormSchema.safeParse({ label: 'P', country: 'SI', supplierId: 'x' }).error?.issues[0]?.message).toBe('plots.errors.supplier');
  });
  it('can be set for a whole import', () => {
    const base = { locale: 'sl', country: 'SI', fileName: 'a.geojson', filePath: null, detectedCrs: 'EPSG:4326', rows: [{ label: 'A', geometry: null, decimals: null }] };
    expect(importPayloadSchema.parse({ ...base, supplierId: null }).supplierId).toBeUndefined();
    expect(importPayloadSchema.parse({ ...base, supplierId: id }).supplierId).toBe(id);
  });
});
