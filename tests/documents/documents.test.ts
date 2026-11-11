import { describe, expect, it } from 'vitest';
import { documentExpiry } from '@/lib/documents/expiry';
import { documentFormSchema, safeFileName } from '@/lib/documents/schemas';

const today = new Date('2026-11-12T10:00:00Z');

describe('documentExpiry', () => {
  it('has no state without an end date', () => expect(documentExpiry(null, today)).toBe('none'));
  it('is valid more than 30 days ahead', () => expect(documentExpiry('2026-12-31', today)).toBe('valid'));
  it('is expiring within 30 days (inclusive)', () => {
    expect(documentExpiry('2026-12-12', today)).toBe('expiring');
    expect(documentExpiry('2026-11-12', today)).toBe('expiring');
  });
  it('is expired after the end date', () => expect(documentExpiry('2026-11-11', today)).toBe('expired'));
});

describe('documentFormSchema', () => {
  const ok = { title: 'Dovoljenje 2026', type: 'felling_permit', validFrom: '2026-01-01', validTo: '2026-12-31', plotIds: '' };
  it('accepts a document', () => {
    const r = documentFormSchema.safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.data?.plotIds).toEqual([]);
  });
  it('parses plot ids from a comma list and drops invalid ones', () => {
    const r = documentFormSchema.safeParse({ ...ok, plotIds: '6f1d3b0e-3c7a-4b8e-9f6a-1a2b3c4d5e6f, x, 6f1d3b0e-3c7a-4b8e-9f6a-1a2b3c4d5e70' });
    expect(r.data?.plotIds).toHaveLength(2);
  });
  it('rejects an end date before the start date', () => {
    expect(documentFormSchema.safeParse({ ...ok, validTo: '2025-12-31' }).error?.issues[0]?.message).toBe('documents.errors.dates');
  });
  it('requires a title and a known type', () => {
    expect(documentFormSchema.safeParse({ ...ok, title: ' ' }).error?.issues[0]?.message).toBe('documents.errors.title');
    expect(documentFormSchema.safeParse({ ...ok, type: 'x' }).error?.issues[0]?.message).toBe('documents.errors.type');
  });
  it('treats empty dates as missing', () => {
    expect(documentFormSchema.safeParse({ ...ok, validFrom: '', validTo: '' }).data).toMatchObject({ validFrom: null, validTo: null });
  });
});

describe('safeFileName', () => {
  it('keeps letters, digits, dots and dashes', () => expect(safeFileName('Odločba št. 12/2026.pdf')).toBe('Odlo_ba_t._12_2026.pdf'));
  it('never returns an empty name', () => expect(safeFileName('///')).toBe('file'));
});
