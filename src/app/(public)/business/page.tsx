import Link from "next/link";
import type { Metadata } from "next";
import { buttonClass, cx } from "@/components/ui";
import { InPrep, SectionHead } from "@/components/public/faq";
import { container } from "@/components/public/format";

export const metadata: Metadata = {
  title: "RENTORA Business za izposojevalnice",
  description:
    "Inventar s fizičnimi enotami, koledar brez dvojnih rezervacij, stranke in QR potni listi opreme. Opremo vnesete enkrat in jo objavite na tržnici RENTORA.",
  alternates: { canonical: "/business" },
};

const days = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
type Bar = { from: number; to: number; kind: "booked" | "out" | "service" };
const rows: { code: string; bars: Bar[] }[] = [
  { code: "RK-01", bars: [{ from: 0, to: 2.5, kind: "out" }, { from: 4, to: 6, kind: "booked" }] },
  { code: "RK-02", bars: [{ from: 1, to: 5, kind: "booked" }] },
  { code: "RK-03", bars: [{ from: 0, to: 1, kind: "booked" }, { from: 3, to: 4.5, kind: "service" }] },
  { code: "RK-04", bars: [] },
  { code: "RK-05", bars: [{ from: 2, to: 7, kind: "booked" }] },
];
const barClass: Record<Bar["kind"], string> = {
  booked: "bg-ink text-white",
  out: "bg-ink-2 text-white",
  service: "hazard",
};
const barLabel: Record<Bar["kind"], string> = { booked: "Rezervirano", out: "V najemu", service: "Servis" };

function TimelineIllustration() {
  return (
    <figure className="rounded-md border border-line-strong bg-surface shadow-float">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-ink">Rušilno kladivo, 5 enot</p>
        <span className="rounded-xs border border-line-strong px-2 py-0.5 text-[11px] text-steel">Ponazoritev</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px] px-4 pt-3 pb-5 sm:px-5" aria-hidden>
          <div className="grid grid-cols-[84px_1fr] items-end gap-3">
            <span />
            <div className="grid grid-cols-7 text-[11px] text-steel">
              {days.map((d) => (
                <span key={d} className="border-l border-line pl-1.5">{d}</span>
              ))}
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {rows.map((r, i) => (
              <div key={r.code} className="grid grid-cols-[84px_1fr] items-center gap-3">
                <span className="asset-tag justify-self-start">{r.code}</span>
                <div className="relative h-8 rounded-xs bg-[repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_calc(100%/7))] bg-sunken">
                  {r.bars.map((b) => (
                    <span
                      key={`${b.from}-${b.kind}`}
                      className={cx("absolute inset-y-1 flex items-center overflow-hidden rounded-xs px-2 text-[11px] font-medium whitespace-nowrap", barClass[b.kind])}
                      style={{ left: `${(b.from / 7) * 100}%`, width: `${((b.to - b.from) / 7) * 100}%` }}
                    >
                      {b.kind === "service" ? <span className="rounded-xs bg-amber px-1 text-ink">{barLabel[b.kind]}</span> : barLabel[b.kind]}
                    </span>
                  ))}
                  {i === 1 && (
                    <span
                      className="absolute -inset-y-0.5 flex items-center justify-end rounded-xs border-2 border-dashed border-bad bg-bad-soft px-2 text-[11px] font-semibold text-bad"
                      style={{ left: `${(3.5 / 7) * 100}%`, width: `${(2.5 / 7) * 100}%` }}
                    >
                      Prekrivanje zavrnjeno
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="border-t border-line px-4 py-3 text-[13px] leading-relaxed text-steel sm:px-5">
        En oglas, pet sledenih enot. Nova rezervacija, ki bi se prekrila z obstoječo na enoti RK-02, se ne shrani.
      </figcaption>
    </figure>
  );
}

/** Deterministic decorative QR-like matrix (not a scannable code). */
function QrMark() {
  const n = 21;
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      if (finder) continue;
      if (((x * 7 + y * 13 + x * y) % 5) < 2) cells.push([x, y]);
    }
  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="size-24 text-ink" aria-hidden shapeRendering="crispEdges">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
      ))}
      <Finder x={0} y={0} />
      <Finder x={n - 7} y={0} />
      <Finder x={0} y={n - 7} />
    </svg>
  );
}

const features: { title: string; body: string; prep?: boolean }[] = [
  {
    title: "Namesto tabel in zvezkov",
    body: "Oprema, enote, stranke in rezervacije so na enem mestu. Ko stranka pokliče, v koledarju vidite, katera enota je prosta, ne da bi brskali po tabelah ali klicali sodelavce.",
  },
  {
    title: "Fizične enote, ne le artikli",
    body: "Pet enakih rušilnih kladiv je en oglas in pet sledenih enot. Vsaka ima svojo inventarno številko in stanje, zato veste, katero kladivo je pri kateri stranki.",
  },
  {
    title: "Koledar, ki ne dovoli dvojne rezervacije",
    body: "Prekrivanje terminov na isti enoti prepreči omejitev v bazi podatkov. Tudi če dva sodelavca hkrati rezervirata isto enoto, se shrani samo ena rezervacija.",
  },
  {
    title: "QR potni list za vsako enoto",
    body: "Vsaka enota ima svojo QR kodo. Ko jo skenirate s telefonom, se odpre potni list enote z njenim stanjem in podatki.",
  },
  {
    title: "Vnesete enkrat, objavite na tržnici",
    body: "Oglas na tržnici RENTORA uporablja iste podatke in isti koledar kot vaša evidenca. Stranke vidijo le, koliko enot je prostih, ne pa vaših strank ali rezervacij.",
  },
  {
    title: "Digitalne pogodbe",
    body: "Najemna pogodba, pripravljena iz podatkov rezervacije, s podpisom ob prevzemu. Sledijo prevzem in vračilo s pregledom stanja ter spletna plačila.",
    prep: true,
  },
];

export default function BusinessPage() {
  return (
    <>
      <section aria-labelledby="business-title" className="overflow-x-clip border-b border-line">
        <div className={cx(container, "grid gap-12 py-14 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-10")}>
          <div className="lg:col-span-5">
            <p className="text-sm font-medium text-steel">RENTORA Business</p>
            <h1 id="business-title" className="display mt-3 text-[40px] text-ink sm:text-[56px]">
              Vsaka enota. Vsak termin. Na enem mestu.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-steel sm:text-lg">
              Sistem za vodenje izposojevalnice opreme in strojev. Inventar, koledar in stranke v brskalniku, oprema pa hkrati na tržnici RENTORA.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass("primary", "lg")}>Začnite 14-dnevni preizkus</Link>
              <Link href="/pricing" className={buttonClass("secondary", "lg")}>Cenik</Link>
            </div>
            <p className="mt-4 text-[13px] text-steel">Kartica za preizkus ni potrebna.</p>
          </div>
          <div className="lg:col-span-7">
            <TimelineIllustration />
          </div>
        </div>
      </section>

      <section aria-labelledby="zmore" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead id="zmore" title="Kaj dobite" lead="Najprej to, kar izposojevalnica potrebuje vsak dan. Funkcije, ki jih še pripravljamo, so označene." />
          <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="border-t border-line-strong pt-5">
                <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                  {f.title}
                  {f.prep && <InPrep />}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-steel">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="potni-list" className="border-y border-line bg-surface py-16 sm:py-24">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12 lg:items-center")}>
          <div className="lg:col-span-6">
            <SectionHead
              id="potni-list"
              title="Potni list opreme"
              lead="Vsaka enota dobi inventarno številko in QR kodo. Kdorkoli v ekipi skenira nalepko s telefonom in takoj vidi, za katero enoto gre in v kakšnem stanju je."
            />
            <ul className="mt-8 space-y-3 text-[15px] text-ink-2">
              <li className="flex gap-3"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />QR koda vodi neposredno na potni list enote, brez iskanja po seznamih.</li>
              <li className="flex gap-3"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />Potni list je vezan na enoto, ne na oglas, zato ostane enak tudi ob spremembi cene.</li>
              <li className="flex flex-wrap gap-3"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" /><span>Zgodovina najemov, pregledov in servisov v potnem listu <InPrep className="ml-1 align-middle" /></span></li>
            </ul>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <figure className="mx-auto max-w-sm rounded-md border border-line-strong bg-paper p-6" aria-label="Ponazoritev nalepke potnega lista">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] text-steel">Rušilno kladivo</p>
                  <p className="mt-2"><span className="asset-tag" data-size="lg">RK-03</span></p>
                </div>
                <QrMark />
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[13px]">
                <span className="text-steel">Stanje enote</span>
                <span className="inline-flex items-center gap-1.5 rounded-xs bg-ok-soft px-2 py-0.5 font-medium text-ok">
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />Na voljo
                </span>
              </div>
              <figcaption className="mt-4 text-[12px] text-mute">Ponazoritev. QR koda na sliki ni prava.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section aria-labelledby="trznica" className="py-16 sm:py-24">
        <div className={cx(container, "grid gap-12 lg:grid-cols-12")}>
          <SectionHead
            id="trznica"
            className="lg:col-span-5"
            title="Tržnica brez dodatnega dela"
            lead="Ko oglas objavite, ga stranke najdejo na RENTORA in preverijo prosto enoto za svoj termin. Razpoložljivost se računa iz istega koledarja, ki ga uporabljate sami."
          />
          <dl className="grid gap-px self-start overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:col-span-7">
            <div className="bg-surface p-6">
              <dt className="text-[15px] font-semibold text-ink">Naročnina</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-steel">Mesečni paket glede na število enot in funkcije. Basic za do 30 enot, Pro brez omejitve.</dd>
            </div>
            <div className="bg-surface p-6">
              <dt className="text-[15px] font-semibold text-ink">Provizija</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-steel">5 % od vrednosti najema samo za rezervacije prek tržnice. Za lastne stranke 0 %.</dd>
            </div>
          </dl>
        </div>
      </section>

    </>
  );
}
