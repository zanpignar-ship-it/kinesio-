import Link from "next/link";
import type { Metadata } from "next";
import { buttonClass, cx, inputClass } from "@/components/ui";
import { listPublicCategories, searchListings, searchSchema } from "@/server/services/marketplace";
import { ListingRow } from "@/components/public/listing-card";
import { Select } from "@/components/public/select";
import { categoryName, container, resultsWord } from "@/components/public/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

/** Lenient parsing: drop any invalid filter instead of failing the whole page. */
function parseFilters(sp: SP) {
  const raw = { q: one(sp.q)?.slice(0, 100), category: one(sp.category), maxDay: one(sp.maxDay), sort: one(sp.sort) };
  const shape = searchSchema.shape;
  const ok = <T,>(r: { success: true; data: T } | { success: false }) => (r.success ? r.data : undefined);
  return {
    q: ok(shape.q.safeParse(raw.q)),
    category: ok(shape.category.safeParse(raw.category)),
    maxDay: ok(shape.maxDay.safeParse(raw.maxDay)),
    sort: ok(shape.sort.safeParse(raw.sort)) ?? "relevance",
    from: isoDate(one(sp.from)),
    to: isoDate(one(sp.to)),
  };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  const filtered = Boolean(f.q || f.maxDay || f.sort !== "relevance");
  return {
    title: f.q ? `Iskanje: ${f.q}` : "Oprema za najem",
    description: "Gradbena mehanizacija, orodja in oprema za najem pri izposojevalnicah po Sloveniji.",
    alternates: { canonical: f.category ? `/equipment?category=${f.category}` : "/equipment" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const f = parseFilters(await searchParams);
  const [categories, results] = await Promise.all([
    listPublicCategories(),
    searchListings({ q: f.q, category: f.category, maxDay: f.maxDay, sort: f.sort }),
  ]);
  const active = categories.find((c) => c.slug === f.category);
  const carry = new URLSearchParams();
  if (f.from) carry.set("from", f.from);
  if (f.to) carry.set("to", f.to);
  const carryQuery = carry.toString() || undefined;
  const hasFilters = Boolean(f.q || f.category || f.maxDay);

  return (
    <div className={cx(container, "py-10 sm:py-14")}>
      <header className="max-w-3xl">
        <h1 className="display text-[34px] text-ink sm:text-[48px]">{active ? categoryName(active.name_i18n) : "Oprema za najem"}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-steel sm:text-base">
          Cene so cene izposojevalnic. Za izbran termin preverite prosto enoto in celotno ceno na strani opreme.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <aside className="lg:col-span-4 xl:col-span-3">
          <form action="/equipment" method="get" role="search" aria-label="Filtri" className="rounded-md border border-line bg-surface p-4 sm:p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold text-ink">Filtri</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="fq" className="mb-1.5 block text-[13px] font-medium text-ink-2">Iskanje</label>
                <input id="fq" name="q" type="search" defaultValue={f.q} placeholder="npr. vibracijska plošča" maxLength={100} className={inputClass} />
              </div>
              <div>
                <label htmlFor="fcat" className="mb-1.5 block text-[13px] font-medium text-ink-2">Kategorija</label>
                <Select id="fcat" name="category" defaultValue={f.category ?? ""}>
                  <option value="">Vse kategorije</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>{categoryName(c.name_i18n)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="fmax" className="mb-1.5 block text-[13px] font-medium text-ink-2">Največ € na dan</label>
                <input id="fmax" name="maxDay" type="number" inputMode="numeric" min={1} step={1} defaultValue={f.maxDay} placeholder="brez omejitve" className={cx(inputClass, "tabular")} />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="fsort" className="mb-1.5 block text-[13px] font-medium text-ink-2">Razvrsti</label>
                <Select id="fsort" name="sort" defaultValue={f.sort}>
                  <option value="relevance">Najnovejše</option>
                  <option value="price_asc">Cena na dan, od najnižje</option>
                  <option value="price_desc">Cena na dan, od najvišje</option>
                </Select>
              </div>
            </div>
            {f.from && <input type="hidden" name="from" value={f.from} />}
            {f.to && <input type="hidden" name="to" value={f.to} />}
            <div className="mt-5 flex items-center gap-3">
              <button type="submit" className={cx(buttonClass("primary", "md"), "flex-1")}>Prikaži rezultate</button>
              {hasFilters && (
                <Link href="/equipment" className="text-sm text-steel underline underline-offset-4 hover:text-ink">Počisti</Link>
              )}
            </div>
          </form>
        </aside>

        <section aria-labelledby="rezultati" className="lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="rezultati" className="tabular text-sm font-medium text-ink" aria-live="polite">{resultsWord(results.length)}</h2>
            {(f.from || f.to) && (
              <p className="text-[13px] text-steel">Izbrane datume prenesemo na stran opreme, kjer preverite razpoložljivost.</p>
            )}
          </div>

          {results.length > 0 ? (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-md border border-line">
              {results.map((l) => (
                <li key={l.id}>
                  <ListingRow l={l} query={carryQuery} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-line-strong bg-surface/60 p-8 sm:p-10">
              <p className="text-lg font-semibold text-ink">{hasFilters ? "Za te filtre ni zadetkov." : "Na tržnici še ni objavljene opreme."}</p>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-steel">
                {hasFilters
                  ? "Poskusite s splošnejšim iskanjem, drugo kategorijo ali višjo ceno na dan."
                  : "Izposojevalnice prav zdaj dodajajo opremo. Če oddajate stroje ali orodja v najem, jih lahko objavite med prvimi."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {hasFilters && <Link href="/equipment" className={buttonClass("secondary", "md")}>Počisti filtre</Link>}
                <Link href="/business" className={buttonClass(hasFilters ? "ghost" : "primary", "md")}>Objavite svojo opremo</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
