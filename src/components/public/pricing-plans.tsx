"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/domain/money";
import { buttonClass, cx } from "@/components/ui";

export type PlanCard = {
  code: string;
  name: string;
  monthCents: number;
  yearCents: number;
  blurb: string;
  limits: string[];
  highlights: { label: string; live: boolean }[];
};

export function PricingPlans({ plans }: { plans: PlanCard[] }) {
  const [period, setPeriod] = useState<"month" | "year">("month");

  return (
    <div>
      <div role="group" aria-label="Obračunsko obdobje" className="inline-flex rounded-sm border border-line-strong bg-surface p-1">
        {(
          [
            ["month", "Mesečno"],
            ["year", "Letno, 2 meseca brezplačno"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={period === v}
            onClick={() => setPeriod(v)}
            className={cx(
              "h-9 rounded-xs px-3.5 text-sm font-medium transition-colors duration-[var(--dur-fast)]",
              period === v ? "bg-ink text-white" : "text-steel hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-8 grid gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-3">
        {plans.map((p) => {
          const featured = p.code === "pro";
          return (
            <li key={p.code} className={cx("relative flex flex-col bg-surface p-6 sm:p-8", featured && "lg:bg-[#fcfcfa]")}>
              {featured && <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-amber" />}
              <div className="flex items-center justify-between gap-3">
                <h3 className="display text-2xl text-ink">{p.name}</h3>
                {featured && <span className="rounded-xs bg-amber px-2 py-0.5 text-xs font-semibold text-ink">Priporočeno</span>}
              </div>
              <p className="mt-3 min-h-[3rem] text-[15px] leading-relaxed text-steel">{p.blurb}</p>

              <p className="mt-6" aria-live="polite">
                <span className="tabular text-[40px] leading-none font-semibold tracking-tight text-ink">
                  {formatMoney(period === "month" ? p.monthCents : p.yearCents).replace(",00", "")}
                </span>
                <span className="ml-1.5 text-sm text-steel">{period === "month" ? "/ mesec" : "/ leto"}</span>
              </p>
              <p className="tabular mt-2 h-5 text-[13px] text-steel">
                {period === "year"
                  ? `Plačate 10 mesecev namesto 12, prihranek ${formatMoney(p.monthCents * 12 - p.yearCents)}.`
                  : `Ali ${formatMoney(p.yearCents).replace(",00", "")} na leto.`}
              </p>

              <ul className="mt-6 space-y-1 border-t border-line pt-5 text-[14px] text-ink-2">
                {p.limits.map((l) => (
                  <li key={l} className="tabular">{l}</li>
                ))}
              </ul>

              <ul className="mt-5 space-y-2.5 text-[14px]">
                {p.highlights.map((h) => (
                  <li key={h.label} className="flex items-start gap-2.5">
                    <svg viewBox="0 0 20 20" className={cx("mt-0.5 size-4 shrink-0", h.live ? "text-ok" : "text-mute")} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {h.live ? <path d="M4.5 10.5 8 14l7.5-8" /> : <circle cx="10" cy="10" r="5.5" strokeDasharray="2.5 2.5" />}
                    </svg>
                    <span className={h.live ? "text-ink" : "text-steel"}>
                      {h.label}
                      {!h.live && <span className="ml-2 inline-flex h-5 items-center rounded-xs border border-line-strong px-1.5 align-middle text-[11px] font-medium text-steel">v pripravi</span>}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <Link href="/signup" className={cx(buttonClass(featured ? "primary" : "secondary", "lg"), "w-full")}>
                  Začnite 14-dnevni preizkus
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
