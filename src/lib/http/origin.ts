import 'server-only';
import { headers } from 'next/headers';

/** Origin of the current request (Vercel sets x-forwarded-*), or null when it does not look like one. */
export async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  return /^https?:\/\/[^/]+$/.test(origin) ? origin : null;
}
