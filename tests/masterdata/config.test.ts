import { describe, expect, it } from 'vitest';
import { toColumns, toFormValues } from '@/lib/masterdata/config';

describe('master data column mapping', () => {
  it('maps product form values to columns and back', () => {
    const cols = toColumns('products', { name: 'Hlodovina', hsCode: '4403', speciesId: 2, tradeName: null });
    expect(cols).toEqual({ name: 'Hlodovina', hs_code: '4403', species_id: 2, trade_name: null });
    expect(toFormValues('products', cols)).toEqual({ name: 'Hlodovina', hsCode: '4403', speciesId: '2', tradeName: '' });
  });
});
