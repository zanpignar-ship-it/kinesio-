import Link from "next/link";
import type { Metadata } from "next";
import { buttonClass, cx, inputClass } from "@/components/ui";
import { listPublicCategories, searchListings } from "@/server/services/marketplace";
import { HeroShowcase } from "@/components/public/hero-showcase";
import { CategoryGlyph } from "@/components/public/equipment-art";
import { ListingTile } from "@/components/public/listing-card";
import { Faq, InPrep, SectionHead } from "@/components/public/faq";
import { Select } from "@/components/public/select";
import { categoryName, container, listingsWord } from "@/components/public/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "RENTORA — najem gradbene mehanizacije, orodij in opreme" },
  description:
    "Poiščite gradbeno mehanizacijo, orodja in opremo pri izposojevalnicah po Sloveniji. Razpoložljivost in cena sta vidni pred rezervacijo.",
  alternates: { canonical: "/" },
};


export default async function HomePage() {
  const [categories, listings] = await Promise.all([listPublicCategories(), searchListings({})]);
  const latest = listings.slice(0, 6);

  return (
    <>
      <HeroShowcase>
        <h1 id="hero-title" className="display text-[44px] text-ink sm:text-[64px] lg:text-[68px] xl:text-[76px]">
          Najemite stroj, ki je res na voljo.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-steel sm:text-lg">
          Gradbena mehanizacija, orodja in oprema pri izposojevalnicah po Sloveniji. Prosto enoto in celotno ceno vidite, preden rezervirate.
        </p>

        <form action="/equipment" method="get" role="search" aria-label="Iskanje opreme" className="mt-8 rounded-md border border-line-strong bg-surface p-4 shadow-raise sm:p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor="hq" className="mb-1.5 block text-[13px] font-medium text-ink-2">Kaj potrebujete?</label>
              <input id="hq" name="q" type="search" placeholder="npr. mini bager, rušilno kladivo" className={cx(inputClass, "h-11 text-[15px]")} maxLength={100} />
            </div>
            <div className="col-span-2">
              <label htmlFor="hcat" className="mb-1.5 block text-[13px] font-medium text-ink-2">Kategorija</label>
              <Select id="hcat" name="category" defaultValue="" className="h-11">
                <option value="">Vse kategorije</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{categoryName(c.name_i18n)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="hfrom" className="mb-1.5 flex justify-between text-[13px] font-medium text-ink-2">Od <span className="font-normal text-mute">neobvezno</span></label>
              <input id="hfrom" name="from" type="date" className={cx(inputClass, "h-11")} />
            </div>
            <div>
              <label htmlFor="hto" className="mb-1.5 flex justify-between text-[13px] font-medium text-ink-2">Do <span className="font-normal text-mute">neobvezno</span></label>
              <input id="hto" name="to" type="date" className={cx(inputClass, "h-11")} />
            </div>
          </div>
          <button type="submit" className={cx(buttonClass("primary", "lg"), "mt-4 w-full")}>
            Poišči opremo
          </button>
        </form>
      </HeroShowcase>

      {/* Categories */}
      <section aria-labelledby="kategorije" className="py-20 sm:py-24">
        <div className={container}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHead id="kategorije" title="Kategorije" lead="Od mini bagrov do agregatov za prireditve. Število ob kategoriji je število objavljenih oglasov." />
            <Link href="/equipment" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Vsa oprema
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug} className="bg-surface">
                <Link href={`/equipment?category=${c.slug}`} className="group flex h-full flex-col gap-6 p-4 transition-colors hover:bg-[#fbfcfa] sm:p-5">
                  <CategoryGlyph icon={c.icon} className="size-10 text-ink-2 transition-colors group-hover:text-ink" />
                  <span>
                    <span className="block text-[14px] leading-snug font-medium text-ink sm:text-[15px]">{categoryName(c.name_i18n)}</span>
                    <span className="tabular mt-1 block text-[13px] text-steel">{c.listings ? listingsWord(c.listings) : "Še brez oglasov"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Latest equipment */}
      <section aria-labelledby="nazadnje" className="border-t border-line bg-surface py-20 sm:py-24">
        <div className={container}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHead id="nazadnje" title="Nazadnje objavljeno" lead="Oprema, ki so jo izposojevalnice nedavno objavile na tržnici." />
            {latest.length > 0 && (
              <Link href="/equipment" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                Prikaži vse
              </Link>
            )}
          </div>
          {latest.length > 0 ? (
            <ul className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((l) => (
                <li key={l.id}>
                  <ListingTile l={l} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-10 grid gap-6 rounded-md border border-dashed border-line-strong p-8 sm:p-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-lg font-semibold text-ink">Tržnica se šele polni.</p>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-steel">
                  Izposojevalnice prav zdaj dodajajo svojo opremo. Če oddajate stroje ali orodja v najem, ste lahko med prvimi, ki jih stranke najdejo tukaj.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
                <Link href="/signup" className={buttonClass("primary", "md")}>Objavite opremo</Link>
                <Link href="/business" className={buttonClass("secondary", "md")}>Kako deluje</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="kako" className="border-t border-line py-20 sm:py-24">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <SectionHead
            id="kako"
            className="lg:col-span-4"
            title="Kako poteka najem"
            lead="Štirje koraki od iskanja do vračila. Brez klicanja več izposojevalnic, da bi izvedeli, ali je stroj prost."
          />
          <ol className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:col-span-8">
            {[
              { t: "Poiščite opremo", b: "Iščite po imenu ali kategoriji in primerjajte cene na dan, teden in mesec." },
              { t: "Preverite termin", b: "Vnesite začetek in konec najema. Takoj vidite, koliko enot je prostih, in ceno za celotno obdobje." },
              { t: "Rezervirajte prek RENTORA", b: "Rezervacijo boste oddali na spletu. Izposojevalnica jo potrdi, pri takojšnji potrditvi pa je potrjena samodejno.", prep: true },
              { t: "Prevzemite in vrnite", b: "Opremo prevzamete pri izposojevalnici ali vam jo dostavi, če ponuja dostavo." },
            ].map((s, i) => (
              <li key={s.t} className="bg-surface p-6 sm:p-7">
                <span className="tabular display text-[32px] text-line-strong" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-5 flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                  {s.t}
                  {s.prep && <InPrep />}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-steel">{s.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* For rental businesses */}
      <section aria-labelledby="podjetja" className="bg-ink py-20 text-white sm:py-24">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <div className="lg:col-span-5">
            <h2 id="podjetja" className="display text-[28px] sm:text-[38px]">Za izposojevalnice</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-base">
              RENTORA Business nadomesti tabele, zvezke in klice za preverjanje zasedenosti. Opremo vnesete enkrat, prikaže se v vašem koledarju in na tržnici.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/business" className={buttonClass("amber", "lg")}>Spoznajte RENTORA Business</Link>
              <Link href="/pricing" className={cx(buttonClass("ghost", "lg"), "border border-white/25 text-white hover:bg-white/10")}>Cenik</Link>
            </div>
          </div>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-7">
            {[
              { t: "Vsaka enota posebej", b: "Pet enakih kladiv je en oglas in pet sledenih enot, vsaka s svojo inventarno številko in stanjem." },
              { t: "Koledar brez dvojnih rezervacij", b: "Ista enota ne more biti oddana dvakrat v istem času. To preverja baza podatkov, ne le zaslon." },
              { t: "Vnesete enkrat", b: "Oglas na tržnici uporablja iste podatke in isti koledar kot vaša interna evidenca." },
              { t: "Brez provizije za lastne stranke", b: "Za stranke, ki jih pridobite sami, provizije ni. Pri rezervacijah prek tržnice je 5 %." },
            ].map((b) => (
              <li key={b.t} className="border-t border-white/15 pt-5">
                <h3 className="text-[15px] font-semibold">{b.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{b.b}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="zaupanje" className="py-20 sm:py-24">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <SectionHead id="zaupanje" className="lg:col-span-4" title="Veste, s kom poslujete" lead="Kar je pomembno za odločitev, vidite pred rezervacijo." />
          <dl className="grid gap-10 sm:grid-cols-3 lg:col-span-8">
            {[
              { t: "Znana izposojevalnica", b: "Pri vsakem oglasu sta navedena ime podjetja in kraj. Veste, s kom sklepate najem, še preden rezervirate." },
              { t: "Cena pred potrditvijo", b: "Cena za izbrano obdobje je izračunana iz dnevne, tedenske in mesečne cene. Varščina je navedena posebej." },
              { t: "Dokumentirana rezervacija", b: "Vsaka rezervacija ima svoj zapis z enotami, termini in spremembami stanja, ki ga vodi izposojevalnica." },
            ].map((x) => (
              <div key={x.t} className="border-t-2 border-ink pt-5">
                <dt className="text-[15px] font-semibold text-ink">{x.t}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-steel">{x.b}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="vprasanja" className="border-t border-line py-20 sm:py-24">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <SectionHead id="vprasanja" className="lg:col-span-4" title="Pogosta vprašanja" />
          <div className="lg:col-span-8">
            <Faq
              items={[
                { q: "Koliko plačam kot najemnik?", a: "Plačate najem po ceni, ki jo določi izposojevalnica in jo vidite pred rezervacijo. Provizijo tržnice plača izposojevalnica, ne vi." },
                { q: "Ali lahko že danes rezerviram na spletu?", a: "Spletna rezervacija prek RENTORA bo na voljo ob zagonu tržnice. Že zdaj lahko poiščete opremo in preverite, koliko enot je v izbranem terminu prostih." },
                { q: "Kako vem, da je stroj res prost?", a: "Razpoložljivost se izračuna iz koledarja izposojevalnice, ki vodi vsako fizično enoto posebej. Ista enota ne more biti rezervirana dvakrat v istem času." },
                { q: "Kdo določi varščino in pogoje najema?", a: "Izposojevalnica. Višina varščine je navedena pri vsakem oglasu." },
                { q: "Vodim izposojevalnico. Kako začnem?", a: (<>Registrirajte podjetje, dodajte opremo in njene enote ter oglas objavite. Prvih 14 dni je brezplačnih, kartica ni potrebna. <Link className="font-medium text-ink underline underline-offset-4" href="/pricing">Cenik</Link> pojasni naročnino in provizijo.</>) },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  );
}
