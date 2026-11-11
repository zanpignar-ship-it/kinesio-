import { describe, expect, it } from 'vitest';
import { customerSchema, productSchema, supplierSchema } from '@/lib/masterdata/schemas';

describe('master data schemas', () => {
  it('validates a customer', () => {
    expect(customerSchema.safeParse({ name: 'Holz GmbH', country: 'AT', email: '' }).data).toMatchObject({ name: 'Holz GmbH', country: 'AT', email: null });
    expect(customerSchema.safeParse({ name: '', country: 'AT' }).error?.issues[0]?.message).toBe('md.errors.name');
    expect(customerSchema.safeParse({ name: 'X', country: 'Austria' }).error?.issues[0]?.message).toBe('md.errors.country');
    expect(customerSchema.safeParse({ name: 'X', country: 'AT', email: 'ni-email' }).error?.issues[0]?.message).toBe('md.errors.email');
  });
  it('validates a product', () => {
    expect(productSchema.safeParse({ name: 'Hlodovina', hsCode: '4403', speciesId: '3' }).data).toMatchObject({ hsCode: '4403', speciesId: 3, tradeName: null });
    expect(productSchema.safeParse({ name: 'X', hsCode: '' }).error?.issues[0]?.message).toBe('md.errors.hsCode');
    expect(productSchema.safeParse({ name: 'X', hsCode: '4403', speciesId: '' }).data?.speciesId).toBeNull();
  });
  it('validates a supplier', () => {
    expect(supplierSchema.safeParse({ name: 'Janez Novak', country: 'SI', kind: 'forest_owner' }).success).toBe(true);
    expect(supplierSchema.safeParse({ name: 'J', country: 'SI', kind: 'x' }).error?.issues[0]?.message).toBe('md.errors.kind');
  });
});
