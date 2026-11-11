export type DocumentExpiry = 'none' | 'valid' | 'expiring' | 'expired';

export const EXPIRING_DAYS = 30;

/** Validity state of a document on `today` (UTC dates). */
export function documentExpiry(validTo: string | null, today: Date = new Date()): DocumentExpiry {
  if (!validTo) return 'none';
  const end = Date.parse(`${validTo}T00:00:00Z`);
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((end - day) / 86_400_000);
  if (days < 0) return 'expired';
  return days <= EXPIRING_DAYS ? 'expiring' : 'valid';
}

/** ISO date (YYYY-MM-DD) `days` from today, for queries. */
export function isoDateIn(days: number, today: Date = new Date()): string {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days)).toISOString().slice(0, 10);
}
