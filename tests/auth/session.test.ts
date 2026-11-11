import { describe, expect, it } from 'vitest';
import { pickOrganization } from '@/lib/auth/pick-organization';

const orgs = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
];

describe('pickOrganization', () => {
  it('uses the organization from the cookie when the user is a member', () => expect(pickOrganization(orgs, 'b')?.id).toBe('b'));
  it('falls back to the first organization for an unknown cookie', () => expect(pickOrganization(orgs, 'x')?.id).toBe('a'));
  it('falls back to the first organization without a cookie', () => expect(pickOrganization(orgs, undefined)?.id).toBe('a'));
  it('returns null without organizations', () => expect(pickOrganization([], 'a')).toBeNull());
});
