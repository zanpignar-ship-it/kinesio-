import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { t } from "@/i18n";
import type { ReservationStatus } from "@/domain/reservation";
import type { UnitStatus } from "@/domain/unit";
import { formatMoney } from "@/domain/money";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-raise",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink/40 shadow-raise",
  ghost: "text-ink hover:bg-sunken",
  danger: "bg-surface text-bad border border-bad/30 hover:bg-bad-soft",
  amber: "bg-amber text-ink hover:brightness-95 shadow-raise",
};
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-[15px]" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md") {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap",
    "transition-[background-color,border-color,transform,filter] duration-[var(--dur-fast)] active:translate-y-px disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
  );
}

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={cx(buttonClass(variant, size), className)} {...p} />;
}

export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...p} />;
}

export const inputClass =
  "w-full h-10 rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-mute " +
  "transition-colors duration-[var(--dur-fast)] hover:border-ink/30 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/20 " +
  "aria-[invalid=true]:border-bad aria-[invalid=true]:ring-bad/15";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
      <span>{children}</span>
      {hint && <span className="font-normal text-mute">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-steel hover:text-ink">
            <span aria-hidden>‹</span> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <div className="mt-1 max-w-2xl text-sm text-steel">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className, padded = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx("rounded-md border border-line bg-surface", className)}>
      {(title || action) && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line-strong bg-surface/60 px-6 py-10">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="max-w-md text-sm text-steel">{body}</p>}
      {action}
    </div>
  );
}

type Tone = "neutral" | "ok" | "info" | "warn" | "bad" | "amber" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  ok: "bg-ok-soft text-ok",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  amber: "bg-amber text-ink",
  ink: "bg-ink text-white",
};

export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-xs px-2 text-xs font-medium whitespace-nowrap", tones[tone])}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

const reservationTone: Record<ReservationStatus, Tone> = {
  draft: "neutral", quotation: "neutral", awaiting_confirmation: "warn", confirmed: "info", awaiting_pickup: "info",
  active: "ok", awaiting_return: "warn", inspection: "warn", completed: "neutral", cancelled: "neutral", expired: "neutral",
  overdue: "bad", disputed: "bad", refunded: "neutral",
};
export function ReservationBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={reservationTone[status]}>{t(`rs.${status}`)}</Badge>;
}

const unitTone: Record<UnitStatus, Tone> = {
  available: "ok", reserved: "info", awaiting_pickup: "info", rented: "ink", awaiting_return: "warn", overdue: "bad",
  inspection: "warn", damaged: "bad", maintenance: "amber", unavailable: "neutral", retired: "neutral",
};
export function UnitBadge({ status }: { status: UnitStatus }) {
  return <Badge tone={unitTone[status]}>{t(`us.${status}`)}</Badge>;
}

export function AssetTag({ code, size }: { code: string; size?: "lg" }) {
  return (
    <span className="asset-tag" data-size={size}>
      {code}
    </span>
  );
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cx("tabular", className)}>{formatMoney(cents)}</span>;
}

const dtf = new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Ljubljana" });
const df = new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Ljubljana" });
export const fmtDateTime = (d: Date | string) => dtf.format(new Date(d));
export const fmtDate = (d: Date | string) => df.format(new Date(d));

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "h-10 border-b border-line bg-paper/60 px-4 text-xs font-medium text-steel";
export const td = "h-12 border-b border-line px-4 align-middle last-of-type:border-b-0";
