import { z } from "zod";
import { withPublic } from "../db";
import { billableDays, quote } from "@/domain/pricing";

/**
 * Public marketplace reads. Runs WITHOUT tenant context, so row-level security
 * exposes only published listings and the public identity of their providers.
 * Availability is computed by a SECURITY DEFINER function that returns counts only.
 */
export type PublicListing = {
  id: string; slug: string; title: string; description: string; manufacturer: string | null; model: string | null;
  specs: Record<string, string>; price_day_cents: number; price_week_cents: number | null; price_month_cents: number | null;
  deposit_cents: number; booking_mode: "instant" | "request"; delivery_available: boolean;
  category_slug: string; category_name: Record<string, string>; provider_name: string; provider_slug: string; provider_city: string | null;
};

const SELECT = `
  select l.id, l.slug, l.title, l.description, l.manufacturer, l.model, l.specs, l.price_day_cents, l.price_week_cents, l.price_month_cents,
         l.deposit_cents, l.booking_mode, l.delivery_available, c.slug as category_slug, c.name_i18n as category_name,
         o.name as provider_name, o.slug as provider_slug, public_location_city(l.org_id) as provider_city
    from listings l join categories c on c.id = l.category_id join organizations o on o.id = l.org_id
   where l.is_published and o.status = 'active'`;

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().regex(/^[a-z0-9-]+$/).optional(),
  maxDay: z.coerce.number().int().positive().optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc"]).default("relevance"),
});

export async function searchListings(input: z.input<typeof searchSchema>) {
  const s = searchSchema.parse(input);
  return withPublic((tx) =>
    tx.query<PublicListing & { units_total: number }>(
      `${SELECT}
         and ($1::text is null or to_tsvector('simple', l.title || ' ' || coalesce(l.manufacturer,'') || ' ' || coalesce(l.model,'') || ' ' || l.description) @@ plainto_tsquery('simple', $1)
              or l.title ilike '%'||$1||'%')
         and ($2::text is null or c.slug = $2)
         and ($3::int is null or l.price_day_cents <= $3 * 100)
       order by case when $4 = 'price_asc' then l.price_day_cents when $4 = 'price_desc' then -l.price_day_cents else 0 end, l.created_at desc
       limit 120`,
      [s.q || null, s.category ?? null, s.maxDay ?? null, s.sort],
    ),
  );
}

export async function getPublicListing(providerSlug: string, listingSlug: string) {
  return withPublic((tx) => tx.maybeOne<PublicListing>(`${SELECT} and o.slug = $1 and l.slug = $2`, [providerSlug, listingSlug]));
}

/** Public availability check: returns only how many units are free, never which ones or why. */
export async function publicAvailability(listingId: string, startsAt: Date, endsAt: Date) {
  if (!(endsAt > startsAt)) return null;
  return withPublic(async (tx) => {
    const l = await tx.maybeOne<{ price_day_cents: number; price_week_cents: number | null; price_month_cents: number | null }>(
      "select price_day_cents, price_week_cents, price_month_cents from listings where id = $1 and is_published", [listingId]);
    if (!l) return null;
    const { free } = await tx.one<{ free: number }>("select public_available_units($1, $2, $3) as free", [listingId, startsAt, endsAt]);
    const days = billableDays(startsAt, endsAt);
    return { free, quote: quote({ dayCents: l.price_day_cents, weekCents: l.price_week_cents, monthCents: l.price_month_cents }, days) };
  });
}

export async function listPublicCategories() {
  return withPublic((tx) =>
    tx.query<{ slug: string; name_i18n: Record<string, string>; icon: string; listings: number }>(
      `select c.slug, c.name_i18n, c.icon, count(l.id)::int as listings
         from categories c left join listings l on l.category_id = c.id and l.is_published
        group by c.id order by c.sort`,
    ),
  );
}
