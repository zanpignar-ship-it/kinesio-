import { describe, expect, it } from 'vitest';
import { auditSubject, changedFields } from '@/lib/audit/format';

describe('audit formatting', () => {
  it('names the row', () => {
    expect(auditSubject(null, { label: 'Gozd A', id: '1' })).toBe('Gozd A');
    expect(auditSubject({ internal_ref: 'S-1' }, null)).toBe('S-1');
    expect(auditSubject({}, {})).toBe('');
  });
  it('lists changed columns without technical ones', () => {
    expect(changedFields({ label: 'A', updated_at: '1', status: 'draft' }, { label: 'B', updated_at: '2', status: 'draft' })).toEqual(['label']);
    expect(changedFields({ geom: { a: 1 }, label: 'A' }, { geom: { a: 2 }, label: 'A' })).toEqual(['geom']);
    expect(changedFields(null, { label: 'A' })).toEqual([]);
  });
});
