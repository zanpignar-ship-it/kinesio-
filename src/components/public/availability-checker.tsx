"use client";

import { useId, useState, type FormEvent } from "react";
import { formatMoney } from "@/domain/money";
import { buttonClass, cx, inputClass } from "@/components/ui";
import { daysWord, unitsWord } from "./format";

type Prices = { dayCents: number; weekCents: number | null; monthCents: number | null };
type Result = { free: number; totalCents: number; days: number; breakdown: { months: number; weeks: number; days: number } };

export function AvailabilityChecker({
  listingId,
  prices,
  depositCents,
  defaultStart,
  defaultEnd,
}: {
  listingId: string;
  prices: Prices;
  depositCents: number;
  defaultStart?: string;
  defaultEnd?: string;
}) {
  const id = useId();
  const [start, setStart] = useState(defaultStart ?? "");
  const [end, setEnd] = useState(defaultEnd ?? "");
  const [state, setState] = useState<{ status: "idle" | "loading" } | { status: "error"; message: string } | { status: "done"; result: Result }>({ status: "idle" });

  async function check(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) return setState({ status: "error", message: "Vnesite začetek in konec najema." });
    const s = new Date(start);
    const en = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) return setState({ status: "error", message: "Vnesite veljaven datum in uro." });
    if (!(en > s)) return setState({ status: "error", message: "Konec mora biti po začetku." });

    setState({ status: "loading" });
    try {
      const qs = new URLSearchParams({ listing: listingId, start: s.toISOString(), end: en.toISOString() });
      const res = await fetch(`/api/public/availability?${qs}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ status: "error", message: body.error ?? "Razpoložljivosti ni bilo mogoče preveriti." });
      setState({ status: "done", result: body as Result });
    } catch {
      setState({ status: "error", message: "Povezava ni uspela. Poskusite znova." });
    }
  }

  const lines = (r: Result) =>
    [
      r.breakdown.months > 0 && prices.monthCents != null && { label: `${r.breakdown.months} × mesečna cena`, cents: r.breakdown.months * prices.monthCents },
      r.breakdown.weeks > 0 && prices.weekCents != null && { label: `${r.breakdown.weeks} × tedenska cena`, cents: r.breakdown.weeks * prices.weekCents },
      r.breakdown.days > 0 && { label: `${r.breakdown.days} × dnevna cena`, cents: r.breakdown.days * prices.dayCents },
    ].filter(Boolean) as { label: string; cents: number }[];

  return (
    <form onSubmit={check} noValidate className="space-y-4" aria-describedby={`${id}-out`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <label htmlFor={`${id}-s`} className="mb-1.5 block text-[13px] font-medium text-ink-2">Začetek</label>
          <input id={`${id}-s`} type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className={cx(inputClass, "tabular")} />
        </div>
        <div>
          <label htmlFor={`${id}-e`} className="mb-1.5 block text-[13px] font-medium text-ink-2">Konec</label>
          <input id={`${id}-e`} type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} className={cx(inputClass, "tabular")} />
        </div>
      </div>
      <button type="submit" disabled={state.status === "loading"} className={cx(buttonClass("primary", "md"), "w-full")}>
        {state.status === "loading" ? "Preverjanje …" : "Preveri termin"}
      </button>

      <div id={`${id}-out`} aria-live="polite" className="empty:hidden">
        {state.status === "error" && (
          <p role="alert" className="rounded-sm bg-bad-soft px-3 py-2 text-[13px] text-bad">{state.message}</p>
        )}
        {state.status === "done" && (
          <div className="rounded-sm border border-line bg-paper p-4">
            <p className={cx("flex items-center gap-2 text-[15px] font-semibold", state.result.free > 0 ? "text-ok" : "text-bad")}>
              <span aria-hidden className="size-2 rounded-full bg-current" />
              {state.result.free > 0 ? `Na voljo: ${unitsWord(state.result.free)}` : "V tem terminu ni proste enote"}
            </p>
            {state.result.free > 0 && (
              <dl className="mt-4 space-y-2 text-[13px]">
                {lines(state.result).map((l) => (
                  <div key={l.label} className="flex justify-between gap-4">
                    <dt className="text-steel">{l.label}</dt>
                    <dd className="tabular text-ink">{formatMoney(l.cents)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-line pt-2 text-[15px]">
                  <dt className="font-medium text-ink">Najem, {daysWord(state.result.days)}</dt>
                  <dd className="tabular font-semibold text-ink">{formatMoney(state.result.totalCents)}</dd>
                </div>
                {depositCents > 0 && (
                  <div className="flex justify-between gap-4 text-steel">
                    <dt>Varščina, ločeno od cene najema</dt>
                    <dd className="tabular">{formatMoney(depositCents)}</dd>
                  </div>
                )}
              </dl>
            )}
            {state.result.free === 0 && <p className="mt-2 text-[13px] text-steel">Poskusite z drugim terminom ali krajšim obdobjem.</p>}
          </div>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-mute">Vsak začeti 24-urni najem se obračuna kot en dan. Cena je izračunana iz cenika izposojevalnice.</p>
    </form>
  );
}
