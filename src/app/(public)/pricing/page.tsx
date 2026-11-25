import Link from "next/link";
import type { Metadata } from "next";
import { withPublic } from "@/server/db";
import { formatMoney } from "@/domain/money";
import { buttonClass, cx } from "@/components/ui";
import { PricingPlans, type PlanCard } from "@/components/public/pricing-plans";
import { FEATURE_GROUPS, PLAN_COPY, locationsLimitLabel, membersLimitLabel, unitsLimitLabel, type PlanRow } from "@/components/public/plan-features";
import { Faq, InPrep, SectionHead } from "@/components/public/faq";
import { container } from "@/components/public/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cenik",
  description: "Naročnina RENTORA Business: Basic, Pro in Enterprise. Pri rezervacijah prek tržnice 5 % provizije, za lastne stranke brez provizije.",
  alternates: { canonical: "/pricing" },
};

async function loadPlans() {
  return withPublic((tx) =>
    tx.query<PlanRow>("select code, name, price_month_cents, price_year_cents, limits, features from subscription_plans where is_active order by sort"),
  );
}

const money0 = (cents: number) => formatMoney(cents).replace(",00", "");

export default async function PricingPage() {
  const plans = await loadPlans();

  const cards: PlanCard[] = plans.map((p) => ({
    code: p.code,
    name: p.name,
    monthCents: p.price_month_cents,
    yearCents: p.price_year_cents,
    blurb: PLAN_COPY[p.code]?.blurb ?? "",
    highlights: PLAN_COPY[p.code]?.highlights ?? [],
    limits: [unitsLimitLabel(p.limits?.units), locationsLimitLabel(p.limits?.locations), membersLimitLabel(p.limits?.members)],
  }));

  const rental = 100_000;
  const commission = Math.round(rental * 0.05);

  return (
    <>
      <section aria-labelledby="cenik" className="border-b border-line py-14 sm:py-20">
        <div className={container}>
          <div className="max-w-3xl">
            <h1 id="cenik" className="display text-[40px] text-ink sm:text-[60px]">Cenik</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-steel sm:text-lg">
              Mesečna naročnina za sistem RENTORA Business. Za rezervacije, ki pridejo prek tržnice, plačate 5 % provizije od vrednosti najema. Za stranke, ki jih pridobite sami, provizije ni.
            </p>
          </div>
          <div className="mt-10">
            <PricingPlans plans={cards} />
          </div>
          <p className="mt-5 text-[13px] text-steel">
            Vsi paketi vključujejo 14 dni brezplačnega preizkusa, kartica ni potrebna. Funkcije z oznako <InPrep className="mx-0.5 align-middle" /> so v razvoju in bodo vključene v navedeni paket, ko bodo na voljo.
          </p>
        </div>
      </section>

      {/* Comparison */}
      <section aria-labelledby="primerjava" className="py-16 sm:py-20">
        <div className={container}>
          <SectionHead id="primerjava" title="Primerjava paketov" lead="Kaj je na voljo danes in kaj pripravljamo." />
          <div className="mt-10 overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[680px] border-collapse text-left text-[14px]">
              <caption className="sr-only">Primerjava funkcij paketov Basic, Pro in Enterprise</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="w-[46%] px-5 py-4 text-[13px] font-medium text-steel">Funkcija</th>
                  {plans.map((p) => (
                    <th key={p.code} scope="col" className="px-4 py-4 text-center">
                      <span className="block text-[15px] font-semibold text-ink">{p.name}</span>
                      <span className="tabular block text-[13px] font-normal text-steel">{money0(p.price_month_cents)} / mesec</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-paper/70">
                  <th scope="rowgroup" colSpan={plans.length + 1} className="px-5 pt-5 pb-2 text-[13px] font-semibold text-ink">Obseg</th>
                </tr>
                {(
                  [
                    ["Enote opreme", (p: PlanRow) => unitsLimitLabel(p.limits?.units)],
                    ["Poslovalnice", (p: PlanRow) => locationsLimitLabel(p.limits?.locations)],
                    ["Uporabniki", (p: PlanRow) => membersLimitLabel(p.limits?.members)],
                  ] as const
                ).map(([label, fn]) => (
                  <tr key={label} className="border-t border-line">
                    <th scope="row" className="px-5 py-3 font-normal text-ink-2">{label}</th>
                    {plans.map((p) => (
                      <td key={p.code} className="tabular px-4 py-3 text-center text-ink">{fn(p).replace(/^Do /, "do ")}</td>
                    ))}
                  </tr>
                ))}
                {FEATURE_GROUPS.map((g) => (
                  <FeatureGroup key={g.title} group={g} plans={plans} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Commission */}
      <section aria-labelledby="provizija" className="border-y border-line bg-surface py-16 sm:py-20">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <div className="lg:col-span-5">
            <SectionHead
              id="provizija"
              title="Provizija tržnice"
              lead="Provizijo plačate samo za rezervacije, ki jih stranka opravi prek tržnice RENTORA. Izračuna se od vrednosti najema, brez varščine."
            />
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
              <div className="flex flex-col justify-between gap-3 bg-paper p-5">
                <dt className="text-[13px] text-steel">Rezervacija prek tržnice</dt>
                <dd className="display tabular text-[36px] text-ink">5 %</dd>
              </div>
              <div className="flex flex-col justify-between gap-3 bg-paper p-5">
                <dt className="text-[13px] text-steel">Lastne stranke: telefon, poslovalnica, vaša spletna stran</dt>
                <dd className="display tabular text-[36px] text-ink">0 %</dd>
              </div>
            </dl>
          </div>

          <figure className="lg:col-span-6 lg:col-start-7">
            <figcaption className="text-[15px] font-semibold text-ink">Primer izračuna</figcaption>
            <dl className="tabular mt-4 divide-y divide-line border-y border-line text-[15px]">
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-ink-2">Vrednost najema prek tržnice</dt>
                <dd className="text-ink">{formatMoney(rental)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-ink-2">Provizija RENTORA, 5 %</dt>
                <dd className="text-ink">−{formatMoney(commission)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4 text-base">
                <dt className="font-semibold text-ink">Izposojevalnica prejme</dt>
                <dd className="font-semibold text-ink">{formatMoney(rental - commission)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-steel">
              Znesek je pred stroški plačilnega prometa in davki. Če isto stranko naslednjič postrežete sami, na primer po telefonu, provizije ni.
            </p>
          </figure>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="cenik-vprasanja" className="py-16 sm:py-20">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <SectionHead id="cenik-vprasanja" className="lg:col-span-4" title="Vprašanja o ceni" />
          <div className="lg:col-span-8">
            <Faq
              items={[
                { q: "Ali lahko RENTORA Business najprej preizkusim?", a: "Da. Prvih 14 dni je brezplačnih in kartica ni potrebna." },
                { q: "Kako deluje letno plačilo?", a: "Pri letnem plačilu plačate deset mesečnih naročnin namesto dvanajstih, torej sta dva meseca brezplačna." },
                { q: "Kdaj plačam provizijo?", a: "Samo za rezervacije, ki jih stranka odda prek tržnice RENTORA. Rezervacije, ki jih vnesete sami za stranke po telefonu, v poslovalnici ali z vaše spletne strani, so brez provizije." },
                { q: "Kaj se zgodi, ko presežem 30 enot v paketu Basic?", a: "Sistem vas opozori, da je dosežena meja paketa. Za več enot izberete paket Pro, ki nima omejitve števila enot." },
                { q: "Kaj pomeni oznaka v pripravi?", a: "Funkcija je v razvoju in še ni na voljo. Ko bo pripravljena, bo vključena v pakete, pri katerih je navedena v primerjavi." },
              ]}
            />
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass("primary", "lg")}>Začnite 14-dnevni preizkus</Link>
              <Link href="/business" className={buttonClass("secondary", "lg")}>Kaj vse zmore RENTORA Business</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureGroup({ group, plans }: { group: (typeof FEATURE_GROUPS)[number]; plans: PlanRow[] }) {
  return (
    <>
      <tr className="border-t border-line bg-paper/70">
        <th scope="rowgroup" colSpan={plans.length + 1} className="px-5 pt-5 pb-2 text-[13px] font-semibold text-ink">{group.title}</th>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.code} className="border-t border-line">
          <th scope="row" className="px-5 py-3 font-normal text-ink-2">
            <span className="flex flex-wrap items-center gap-2">
              {r.label}
              {!r.live && <InPrep />}
            </span>
          </th>
          {plans.map((p) => {
            const has = p.features?.includes(r.code);
            return (
              <td key={p.code} className="px-4 py-3 text-center">
                {has ? (
                  <svg viewBox="0 0 20 20" className={cx("mx-auto size-5", r.live ? "text-ink" : "text-mute")} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={r.live ? "Vključeno" : "Vključeno, v pripravi"}>
                    <path d="M4.5 10.5 8 14l7.5-8" />
                  </svg>
                ) : (
                  <span className="text-line-strong" aria-label="Ni vključeno" role="img">–</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
