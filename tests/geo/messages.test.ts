import { describe, expect, it } from 'vitest';
import sl from '../../messages/sl.json';
import { ALL_ISSUE_CODES } from '@/lib/geo/types';

const issues: Record<string, string> = sl.geo.issues;

describe('Slovenian issue messages', () => {
  it.each(ALL_ISSUE_CODES)('has a message for %s', (code) => {
    expect(typeof issues[code]).toBe('string');
    expect(issues[code]!.length).toBeGreaterThan(10);
  });
  it('has no messages for unknown codes', () => {
    expect(Object.keys(issues).sort()).toEqual([...ALL_ISSUE_CODES].sort());
  });
});
