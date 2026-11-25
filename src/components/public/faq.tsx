import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode };

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
            <span>{it.q}</span>
            <svg viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 text-steel transition-transform duration-[var(--dur-base)] group-open:rotate-45" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
              <path d="M10 4v12M4 10h12" />
            </svg>
          </summary>
          <div className="max-w-2xl pb-6 text-[15px] leading-relaxed text-steel">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

export function SectionHead({ id, title, lead, className }: { id?: string; title: string; lead?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 id={id} className="display text-[28px] text-ink sm:text-[38px]">
        {title}
      </h2>
      {lead && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-steel sm:text-base">{lead}</p>}
    </div>
  );
}

/** Small inline status marker for features that are not live yet. */
export function InPrep({ className }: { className?: string }) {
  return (
    <span className={["inline-flex h-5 items-center rounded-xs border border-line-strong bg-surface px-1.5 text-[11px] font-medium whitespace-nowrap text-steel", className].filter(Boolean).join(" ")}>
      v pripravi
    </span>
  );
}
