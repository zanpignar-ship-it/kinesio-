import { cx } from "./ui";

/** Wordmark: expanded industrial type with a tag-hole mark. */
export function Logo({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", inverted ? "text-white" : "text-ink", className)}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="4" fill="var(--amber)" />
        <circle cx="6.5" cy="11" r="2" fill={inverted ? "var(--ink)" : "var(--paper)"} />
        <path d="M11 6.5h4.2a2.6 2.6 0 0 1 0 5.2H11zm0 5.2 4.6 4" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="display text-[17px] tracking-[0.04em]" style={{ lineHeight: 1 }}>RENTORA</span>
    </span>
  );
}
