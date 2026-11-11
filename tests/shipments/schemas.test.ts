import { describe, expect, it } from 'vitest';
import { shipmentFormSchema, submitSchema } from '@/lib/shipments/schemas';

const P = '6f1d3b0e-3c7a-4b8e-9f6a-1a2b3c4d5e6f';
const base = {
  internalRef: 'S-1', customerId: '', shipmentDate: '2026-11-20', mode: 'submit_dds', activity: 'export', countryOfProduction: 'SI',
  items: JSON.stringify([{ productId: P, netMassKg: '24000', volumeM3: '', pieces: '' }]),
  plotIds: `${P}`, documentIds: '', references: '[]',
};

describe('shipmentFormSchema', () => {
  it('parses a shipment with items, plots and empty optional fields', () => {
    const r = shipmentFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ customerId: null, items: [{ productId: P, netMassKg: 24000, volumeM3: null, pieces: null }], plotIds: [P], documentIds: [], references: [] });
  });
  it('accepts decimal commas in quantities', () => {
    const r = shipmentFormSchema.safeParse({ ...base, items: JSON.stringify([{ productId: P, netMassKg: '', volumeM3: '12,5', pieces: '' }]) });
    expect(r.data?.items[0]?.volumeM3).toBe(12.5);
  });
  it('rejects negative quantities, missing products and an empty reference', () => {
    expect(shipmentFormSchema.safeParse({ ...base, items: JSON.stringify([{ productId: P, netMassKg: '-1' }]) }).error?.issues[0]?.message).toBe('ship.errors.quantity');
    expect(shipmentFormSchema.safeParse({ ...base, items: JSON.stringify([{ productId: '' }]) }).error?.issues[0]?.message).toBe('ship.errors.product');
    expect(shipmentFormSchema.safeParse({ ...base, internalRef: ' ' }).error?.issues[0]?.message).toBe('ship.errors.internalRef');
    expect(
      shipmentFormSchema.safeParse({ ...base, references: JSON.stringify([{ kind: 'dds', referenceNo: ' ', verificationNo: '', supplierId: '' }]) }).error?.issues[0]?.message,
    ).toBe('ship.errors.referenceNo');
  });
  it('treats broken JSON as empty lists', () => {
    expect(shipmentFormSchema.safeParse({ ...base, items: '{x', references: 'nope' }).data).toMatchObject({ items: [], references: [] });
  });
});

describe('submitSchema', () => {
  it('needs a DDS reference number', () => {
    expect(submitSchema.safeParse({ ddsReference: ' 26SI123 ', ddsVerification: '' }).data).toEqual({ ddsReference: '26SI123', ddsVerification: null });
    expect(submitSchema.safeParse({ ddsReference: '' }).error?.issues[0]?.message).toBe('ship.errors.ddsReference');
  });
});
