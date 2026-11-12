import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM with the key from LESTRACE_ENCRYPTION_KEY (base64, 32 bytes). Output: v1.<iv>.<tag>.<ciphertext>. */
function key(): Buffer {
  const raw = process.env.LESTRACE_ENCRYPTION_KEY;
  const k = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (k.length !== 32) throw new Error('LESTRACE_ENCRYPTION_KEY must be 32 bytes (base64)');
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decryptSecret(sealed: string): string {
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
