import type { Database } from '@/lib/db/database.types';

type OrgSize = Database['public']['Enums']['org_size'];

/**
 * Date from which EUDR applies to the organization (Regulation (EU) 2025/2650).
 * Micro and small operators: 30 Jun 2027, except those already covered by the EU Timber Regulation.
 * TODO: preveri čl. 38 konsolidiranega besedila (izjema za mikro/male, ki so bili pod EUTR).
 */
export function eudrStartDate(size: OrgSize, wasUnderEutr: boolean): '2026-12-30' | '2027-06-30' {
  if (size === 'micro' || size === 'small') return wasUnderEutr ? '2026-12-30' : '2027-06-30';
  return '2026-12-30';
}

/** Whole days from `now` until the start of `isoDate` (UTC); 0 once the date has passed. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((target - today) / 86_400_000));
}
