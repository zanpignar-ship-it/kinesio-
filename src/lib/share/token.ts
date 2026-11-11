import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes (base64url, 43 characters) and its SHA-256 – only the hash is stored. */
export function createShareToken(): { token: string; hashHex: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hashHex: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
