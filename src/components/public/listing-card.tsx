import Link from "next/link";
import { formatMoney } from "@/domain/money";
import type { PublicListing } from "@/server/services/marketplace";
import { cx } from "@/components/ui";
import { ListingArt } from "./equipment-art";
import { categoryName } from "./format";

type Item = PublicListing & { units_total?: number };

const iconBySlug: Record<string, string> = {
  "gradbena-mehanizacija": "excavator",
  "dvizna-tehnika": "lift",
  orodja: "drill",
  "rusenje-in-vrtanje": "hammer",
  "zbijanje-tal": "compactor",
  energija: "generator",
  kompresorji: "compressor",
  prikolice: "trailer",
  kmetijstvo: "tractor",
  "vrt-in-okolica": "leaf",
  ciscenje: "cleaning",
  dogodki: "tent",
};
export const iconForCategory = (slug: string) => iconBySlug[slug] ?? "excavator";

export const listingHref = (l: Pick<PublicListing, "provider_slug" | "slug">, query?: string) =>
  `/equipment/${l.provider_slug}/${l.slug}${query ? `?${query}` : ""}`;

function BookingMode({ mode }: { mode: PublicListing["booking_mode"] }) {
  return (
    <span className="text-[13px] text-steel">{mode === "instant" ? "Takojšnja potrditev" : "Na povpraševanje"}</span>
  );
}

/** Tile for the homepage ledger grid. */
export function ListingTile({ l }: { l: Item }) {
  return (
    <Link href={listingHref(l)} className="group flex h-full flex-col bg-surface transition-colors hover:bg-[#fbfcfa] focus-visible:relative focus-visible:z-10">
      <ListingArt icon={iconForCategory(l.category_slug)} className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[13px] text-steel">{categoryName(l.category_name)}</p>
        <h3 className="mt-1 text-[15px] leading-snug font-semibold text-ink group-hover:underline group-hover:underline-offset-4">{l.title}</h3>
        <p className="mt-1 text-[13px] text-steel">
          {l.provider_name}
          {l.provider_city && <span className="text-mute">, {l.provider_city}</span>}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p>
            <span className="tabular text-lg font-semibold text-ink">{formatMoney(l.price_day_cents)}</span>
            <span className="ml-1 text-[13px] text-steel">/ dan</span>
          </p>
          <BookingMode mode={l.booking_mode} />
        </div>
      </div>
    </Link>
  );
}

/** Row for search results. */
export function ListingRow({ l, query }: { l: Item; query?: string }) {
  return (
    <Link
      href={listingHref(l, query)}
      className="group grid grid-cols-[72px_1fr] gap-4 bg-surface p-4 transition-colors hover:bg-[#fbfcfa] sm:grid-cols-[112px_1fr_auto] sm:items-center sm:gap-6 sm:p-5"
    >
      <ListingArt icon={iconForCategory(l.category_slug)} className="aspect-square w-full rounded-sm" />
      <div className="min-w-0">
        <p className="text-[13px] text-steel">{categoryName(l.category_name)}</p>
        <h2 className="mt-0.5 text-[15px] leading-snug font-semibold text-ink group-hover:underline group-hover:underline-offset-4 sm:text-base">{l.title}</h2>
        <p className="mt-1 text-[13px] text-steel">
          {l.provider_name}
          {l.provider_city && <span className="text-mute">, {l.provider_city}</span>}
        </p>
        {l.delivery_available && <p className="mt-2 text-[13px] text-ink-2">Možna dostava</p>}
      </div>
      <div className={cx("col-span-2 flex items-baseline justify-between gap-4 border-t border-line pt-3", "sm:col-span-1 sm:block sm:border-0 sm:pt-0 sm:text-right")}>
        <p>
          <span className="tabular text-lg font-semibold text-ink">{formatMoney(l.price_day_cents)}</span>
          <span className="ml-1 text-[13px] text-steel">/ dan</span>
        </p>
        <p className="sm:mt-1">
          <BookingMode mode={l.booking_mode} />
        </p>
      </div>
    </Link>
  );
}
