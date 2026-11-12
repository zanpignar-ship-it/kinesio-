import { describe, expect, it } from 'vitest';
import { bulkChanges, bulkSchema } from '@/lib/plots/bulk';

const id = '0b6f2c8e-6d1a-4c55-9b7e-2f1d0b5f9a11';
const base = { ids: [id], action: 'update' as const, supplier: '' as const, harvestFrom: '', harvestTo: '' };

describe('bulk plot changes', () => {
  it('only changes the fields that were filled in', () => {
    expect(bulkChanges(bulkSchema.parse(base))).toBeNull();
    expect(bulkChanges(bulkSchema.parse({ ...base, supplier: id, harvestFrom: '2026-01-01' }))).toEqual({ supplier_id: id, harvest_from: '2026-01-01' });
    expect(bulkChanges(bulkSchema.parse({ ...base, supplier: 'none' }))).toEqual({ supplier_id: null });
    expect(Object.keys(bulkChanges(bulkSchema.parse({ ...base, action: 'archive' }))!)).toEqual(['archived_at']);
  });
  it('validates the selection and dates', () => {
    expect(bulkSchema.safeParse({ ...base, ids: [] }).error?.issues[0]?.message).toBe('plots.errors.noneSelected');
    expect(bulkSchema.safeParse({ ...base, harvestFrom: '2026-03-01', harvestTo: '2026-01-01' }).error?.issues[0]?.message).toBe('plots.errors.harvest');
    expect(bulkSchema.safeParse({ ...base, ids: ['x'] }).success).toBe(false);
  });
});
