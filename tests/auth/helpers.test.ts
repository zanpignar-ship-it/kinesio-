import { describe, expect, it } from 'vitest';
import { homeFor, safeNext } from '@/lib/auth/redirect';
import { daysUntil, eudrStartDate } from '@/lib/eudr/deadline';
import { organizationSchema, signInSchema, signUpSchema } from '@/lib/auth/schemas';

describe('safeNext', () => {
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined])('rejects %s', (v) => {
    expect(safeNext(v)).toBe('/app');
  });
  it('keeps a relative path', () => expect(safeNext('/app/plots?x=1')).toBe('/app/plots?x=1'));
  it('uses the given fallback', () => expect(safeNext('//x', '/onboarding')).toBe('/onboarding'));
});

describe('homeFor', () => {
  it('sends signed-out users to login', () => expect(homeFor({ signedIn: false, orgCount: 0 })).toBe('/login'));
  it('sends users without an organization to onboarding', () => expect(homeFor({ signedIn: true, orgCount: 0 })).toBe('/onboarding'));
  it('sends members to the app', () => expect(homeFor({ signedIn: true, orgCount: 2 })).toBe('/app'));
});

describe('eudrStartDate', () => {
  it.each([
    ['large', false, '2026-12-30'],
    ['medium', false, '2026-12-30'],
    ['small', false, '2027-06-30'],
    ['micro', false, '2027-06-30'],
    ['small', true, '2026-12-30'],
  ] as const)('%s, under EUTR %s → %s', (size, eutr, expected) => {
    expect(eudrStartDate(size, eutr)).toBe(expected);
  });
  it('counts days until a date (never negative)', () => {
    expect(daysUntil('2026-12-30', new Date('2026-11-12T10:00:00Z'))).toBe(48);
    expect(daysUntil('2026-12-30', new Date('2027-01-05T10:00:00Z'))).toBe(0);
  });
});

describe('form schemas', () => {
  it('accepts a valid sign-in and rejects a bad e-mail', () => {
    expect(signInSchema.safeParse({ email: 'a@b.si', password: 'x' }).success).toBe(true);
    const bad = signInSchema.safeParse({ email: 'ni-email', password: 'x' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('auth.errors.email');
  });
  it('requires an 8 character password on sign-up', () => {
    const r = signUpSchema.safeParse({ email: 'a@b.si', password: 'kratko' });
    expect(r.error?.issues[0]?.message).toBe('auth.errors.passwordTooShort');
    expect(signUpSchema.safeParse({ email: ' A@B.si ', password: 'dovolj-dolgo' }).data?.email).toBe('a@b.si');
  });
  it('validates an organization', () => {
    const ok = organizationSchema.safeParse({ name: 'Žaga Novak d.o.o.', country: 'SI', kind: 'operator', size: 'small', wasUnderEutr: 'on' });
    expect(ok.success).toBe(true);
    expect(ok.data?.wasUnderEutr).toBe(true);
    expect(organizationSchema.safeParse({ name: ' ', country: 'SI', kind: 'operator', size: 'small' }).error?.issues[0]?.message).toBe('org.errors.name');
    expect(organizationSchema.safeParse({ name: 'X', country: 'XX', kind: 'operator', size: 'small' }).error?.issues[0]?.message).toBe('org.errors.country');
    expect(organizationSchema.safeParse({ name: 'X', country: 'SI', kind: 'operator', size: 'small' }).data?.wasUnderEutr).toBe(false);
  });
});
