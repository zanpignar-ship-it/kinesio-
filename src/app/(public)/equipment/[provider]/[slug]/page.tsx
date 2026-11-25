import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { formatMoney } from "@/domain/money";
import { cx } from "@/components/ui";
import { getPublicListing } from "@/server/services/marketplace";
import { ListingArt } from "@/components/public/equipment-art";
import { iconForCategory, listingHref } from "@/components/public/listing-card";
import { AvailabilityChecker } from "@/components/public/availability-checker";
import { SITE_URL, categoryName, container } from "@/components/public/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ provider: string; slug: string }>;
const SLUG = /^[a-z0-9-]{1,120}$/;

const load = cache(async (provider: string, slug: string) => {
  if (!SLUG.test(provider) || !SLUG.test(slug)) return null;
  return getPublicListing(provider, slug);
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { provider, slug } = await params;
  const l = await load(provider, slug);
  if (!l) return { title: "Oprema ni na voljo", robots: { index: false } };
  const description = (l.description || `${l.title} za najem pri ${l.provider_name}.`).replace(/\s+/g, " ").slice(0, 155);
  const canonical = listingHref(l);
  return {
    title: `${l.title}, najem`,
    description,
    alternates: { canonical },
    openGraph: { title: l.title, description, url: canonical, type: "website" },
  };
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export default async function ListingPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { provider, slug } = await params;
  const l = await load(provider, slug);
  if (!l) notFound();

  const sp = await searchParams;
  const from = typeof sp.from === "string" && dateRe.test(sp.from) ? sp.from : undefined;
  const to = typeof sp.to === "string" && dateRe.test(sp.to) ? sp.to : undefined;

  const cat = categoryName(l.category_name);
  const specs: [string, string][] = [
    ...(l.manufacturer ? [["Proizvajalec", l.manufacturer] as [string, string]] : []),
    ...(l.model ? [["Model", l.model] as [string, string]] : []),
    ...Object.entries(l.specs ?? {}).filter(([k, v]) => k && v != null && String(v).trim() !== "").map(([k, v]) => [k, String(v)] as [string, string]),
  ];

  const url = `${SITE_URL}${listingHref(l)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description || undefined,
    category: cat,
    url,
    ...(l.manufacturer ? { brand: { "@type": "Brand", name: l.manufacturer } } : {}),
    ...(l.model ? { model: l.model } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: (l.price_day_cents / 100).toFixed(2),
      businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (l.price_day_cents / 100).toFixed(2),
        priceCurrency: "EUR",
        unitCode: "DAY",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "DAY" },
      },
      seller: {
        "@type": "Organization",
        name: l.provider_name,
        ...(l.provider_city ? { address: { "@type": "PostalAddress", addressLocality: l.provider_city, addressCountry: "SI" } } : {}),
      },
    },
  };

  const priceRows = [
    { label: "Na dan", cents: l.price_day_cents },
    l.price_week_cents != null ? { label: "Na teden", cents: l.price_week_cents } : null,
    l.price_month_cents != null ? { label: "Na mesec", cents: l.price_month_cents } : null,
  ].filter(Boolean) as { label: string; cents: number }[];

  return (
    <div className={cx(container, "py-8 sm:py-12")}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Drobtinice" className="text-[13px] text-steel">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li><Link href="/equipment" className="hover:text-ink hover:underline hover:underline-offset-4">Oprema</Link></li>
          <li aria-hidden className="text-line-strong">/</li>
          <li><Link href={`/equipment?category=${l.category_slug}`} className="hover:text-ink hover:underline hover:underline-offset-4">{cat}</Link></li>
          <li aria-hidden className="text-line-strong">/</li>
          <li aria-current="page" className="truncate text-ink-2">{l.title}</li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <article className="lg:col-span-7">
          <header>
            <p className="text-[13px] text-steel">{cat}</p>
            <h1 className="display mt-2 text-[32px] text-ink sm:text-[44px]">{l.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <p>
                <span className="text-steel">Ponudnik </span>
                <span className="font-medium text-ink">{l.provider_name}</span>
                {l.provider_city && <span className="text-steel">, {l.provider_city}</span>}
              </p>
            </div>
          </header>

          <ListingArt icon={iconForCategory(l.category_slug)} className="mt-8 aspect-[16/9] w-full rounded-md border border-line" />

          {l.description && (
            <section aria-labelledby="opis" className="mt-10">
              <h2 id="opis" className="text-base font-semibold text-ink">Opis</h2>
              <div className="mt-3 max-w-2xl space-y-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{l.description}</div>
            </section>
          )}

          <section aria-labelledby="podatki" className="mt-10">
            <h2 id="podatki" className="text-base font-semibold text-ink">Tehnični podatki in pogoji</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-[15px]">
              {specs.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3">
                  <dt className="text-steel">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3">
                <dt className="text-steel">Varščina</dt>
                <dd className="tabular text-ink">{l.deposit_cents > 0 ? formatMoney(l.deposit_cents) : "Ni zahtevana"}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3">
                <dt className="text-steel">Potrditev</dt>
                <dd className="text-ink">{l.booking_mode === "instant" ? "Takojšnja, če je enota prosta" : "Na povpraševanje, izposojevalnica potrdi termin"}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3">
                <dt className="text-steel">Dostava</dt>
                <dd className="text-ink">{l.delivery_available ? "Možna, po dogovoru z izposojevalnico" : "Ne, prevzem pri izposojevalnici"}</dd>
              </div>
            </dl>
          </section>
        </article>

        <aside aria-label="Cena in razpoložljivost" className="lg:col-span-5">
          <div className="rounded-md border border-line bg-surface lg:sticky lg:top-24">
            <div className="border-b border-line p-5 sm:p-6">
              <p>
                <span className="tabular text-[32px] leading-none font-semibold tracking-tight text-ink">{formatMoney(l.price_day_cents)}</span>
                <span className="ml-1 text-sm text-steel">/ dan</span>
              </p>
              <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-px overflow-hidden rounded-sm border border-line bg-line text-[13px]">
                {priceRows.map((p) => (
                  <div key={p.label} className="bg-paper px-3 py-2.5">
                    <dt className="text-steel">{p.label}</dt>
                    <dd className="tabular mt-0.5 font-medium text-ink">{formatMoney(p.cents)}</dd>
                  </div>
                ))}
                <div className="bg-paper px-3 py-2.5">
                  <dt className="text-steel">Varščina</dt>
                  <dd className="tabular mt-0.5 font-medium text-ink">{l.deposit_cents > 0 ? formatMoney(l.deposit_cents) : "Brez"}</dd>
                </div>
              </dl>
            </div>
            <div className="p-5 sm:p-6">
              <h2 className="mb-4 text-[15px] font-semibold text-ink">Preverite termin</h2>
              <AvailabilityChecker
                listingId={l.id}
                prices={{ dayCents: l.price_day_cents, weekCents: l.price_week_cents, monthCents: l.price_month_cents }}
                depositCents={l.deposit_cents}
                defaultStart={from ? `${from}T08:00` : undefined}
                defaultEnd={to ? `${to}T17:00` : undefined}
              />
            </div>
            <div className="border-t border-line bg-paper/60 p-5 text-[13px] leading-relaxed text-steel sm:p-6">
              Spletna rezervacija prek RENTORA bo na voljo ob zagonu tržnice.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
