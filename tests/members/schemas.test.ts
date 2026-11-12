import { describe, expect, it } from 'vitest';
import { acceptErrorKey, inviteSchema } from '@/lib/members/schemas';

describe('inviteSchema', () => {
  it('normalises the e-mail and accepts both roles', () => {
    expect(inviteSchema.parse({ email: '  Ana@Zaga.SI ', role: 'member' })).toEqual({ email: 'ana@zaga.si', role: 'member' });
    expect(inviteSchema.safeParse({ email: 'ana@zaga.si', role: 'owner' }).success).toBe(true);
  });
  it('rejects bad input with translation keys', () => {
    expect(inviteSchema.safeParse({ email: 'ana', role: 'member' }).error?.issues[0]?.message).toBe('members.errors.email');
    expect(inviteSchema.safeParse({ email: 'ana@zaga.si', role: 'admin' }).error?.issues[0]?.message).toBe('members.errors.role');
  });
});

describe('acceptErrorKey', () => {
  it('maps database hints', () => {
    expect(acceptErrorKey('LT_INVITATION_EMAIL')).toBe('members.errors.otherEmail');
    expect(acceptErrorKey('LT_INVITATION_INVALID')).toBe('members.errors.invalid');
    expect(acceptErrorKey(undefined)).toBe('members.errors.unknown');
  });
});
