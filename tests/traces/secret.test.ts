import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '@/lib/traces/secret';

const saved = process.env.LESTRACE_ENCRYPTION_KEY;
beforeEach(() => {
  process.env.LESTRACE_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});
afterEach(() => {
  process.env.LESTRACE_ENCRYPTION_KEY = saved;
});

describe('secret storage', () => {
  it('round-trips and never contains the plain text', () => {
    const sealed = encryptSecret('my-auth-key-ČŠŽ');
    expect(sealed).not.toContain('my-auth-key');
    expect(decryptSecret(sealed)).toBe('my-auth-key-ČŠŽ');
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });
  it('detects tampering and a wrong key', () => {
    const sealed = encryptSecret('secret');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('other').toString('base64');
    expect(() => decryptSecret(parts.join('.'))).toThrow();
    process.env.LESTRACE_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => decryptSecret(sealed)).toThrow();
  });
  it('refuses to work without a proper key', () => {
    process.env.LESTRACE_ENCRYPTION_KEY = 'short';
    expect(() => encryptSecret('x')).toThrow(/32 bytes/);
  });
});
