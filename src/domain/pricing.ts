export type ListingPrices = {
  dayCents: number;
  weekCents?: number | null;
  monthCents?: number | null;
};

export type PriceQuote = {
  days: number;
  totalCents: number;
  breakdown: { months: number; weeks: number; days: number };
};

const HOUR = 3_600_000;

/** Billable rental days: every started 24h period counts as one day (min 1). */
export function billableDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (!(ms > 0)) throw new RangeError("end must be after start");
  return Math.max(1, Math.ceil(ms / (24 * HOUR) - 1e-9));
}

/**
 * Cheapest combination of day / week (7d) / month (30d) rates covering at
 * least `days` days. Dynamic programming, so a week rate is applied to 5 days
 * when that is cheaper than 5 × day rate.
 */
export function quote(prices: ListingPrices, days: number): PriceQuote {
  if (!Number.isInteger(days) || days < 1) throw new RangeError("days must be a positive integer");
  const opts: { len: number; cents: number; key: "days" | "weeks" | "months" }[] = [
    { len: 1, cents: prices.dayCents, key: "days" },
  ];
  if (prices.weekCents != null) opts.push({ len: 7, cents: prices.weekCents, key: "weeks" });
  if (prices.monthCents != null) opts.push({ len: 30, cents: prices.monthCents, key: "months" });

  const cost = new Array<number>(days + 1).fill(Infinity);
  const pick = new Array<number>(days + 1).fill(-1);
  cost[0] = 0;
  for (let i = 1; i <= days; i++) {
    opts.forEach((o, idx) => {
      const c = cost[Math.max(0, i - o.len)] + o.cents;
      if (c < cost[i]) {
        cost[i] = c;
        pick[i] = idx;
      }
    });
  }
  const breakdown = { months: 0, weeks: 0, days: 0 };
  for (let i = days; i > 0; ) {
    const o = opts[pick[i]];
    breakdown[o.key]++;
    i = Math.max(0, i - o.len);
  }
  return { days, totalCents: cost[days], breakdown };
}

export function applyDiscount(cents: number, percent: number) {
  const discount = Math.round((cents * Math.min(100, Math.max(0, percent))) / 100);
  return { discountCents: discount, totalCents: cents - discount };
}
