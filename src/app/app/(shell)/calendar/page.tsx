import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getTimeline } from "@/server/services/reservations";
import { cx, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { localToDate, dateToLocal } from "@/lib/datetime";
import { Timeline } from "./timeline";
import { moveReservationAction } from "../reservations/actions";

export const metadata: Metadata = { title: "Koledar" };

const RANGES = [[7, "Teden"], [14, "2 tedna"], [31, "Mesec"]] as const;

function startOfDay(d: Date) {
  return localToDate(dateToLocal(d).slice(0, 10) + "T00:00")!;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; days?: string }> }) {
  const actor = await requireActor("reservations.read");
  const sp = await searchParams;
  const days = RANGES.some(([d]) => String(d) === sp.days) ? Number(sp.days) : 14;
  const base = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? localToDate(`${sp.from}T00:00`)! : startOfDay(new Date(Date.now() - 86400000));
  const to = new Date(base.getTime() + days * 86400000);
  const { units, allocations } = await getTimeline(actor, base, to);
  const iso = (d: Date) => dateToLocal(d).slice(0, 10);
  const shift = (n: number) => `/app/calendar?days=${days}&from=${iso(new Date(base.getTime() + n * 86400000))}`;
  const range = new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "long", timeZone: "Europe/Ljubljana" });

  return (
    <>
      <PageHeader title="Koledar" description={`${range.format(base)} – ${range.format(new Date(to.getTime() - 1))}. Povlecite rezervacijo, da jo prestavite; prekrivanja strežnik zavrne.`}
        actions={<LinkButton href="/app/reservations/new"><Icon name="plus" className="size-4" />Nova rezervacija</LinkButton>} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={shift(-Math.min(days, 7))} className="grid size-9 place-items-center rounded-sm border border-line-strong bg-surface hover:border-ink/40" aria-label="Prejšnje obdobje"><span aria-hidden>‹</span></Link>
          <Link href={`/app/calendar?days=${days}`} className="h-9 rounded-sm border border-line-strong bg-surface px-3 text-sm leading-9 hover:border-ink/40">Danes</Link>
          <Link href={shift(Math.min(days, 7))} className="grid size-9 place-items-center rounded-sm border border-line-strong bg-surface hover:border-ink/40" aria-label="Naslednje obdobje"><span aria-hidden>›</span></Link>
        </div>
        <nav aria-label="Razpon" className="inline-flex rounded-sm bg-sunken p-0.5 text-[13px]">
          {RANGES.map(([d, l]) => (
            <Link key={d} href={`/app/calendar?days=${d}&from=${iso(base)}`} aria-current={d === days ? "page" : undefined}
              className={cx("h-8 rounded-xs px-3 leading-8", d === days ? "bg-surface font-medium shadow-raise" : "text-steel")}>{l}</Link>
          ))}
        </nav>
      </div>
      {units.length === 0 ? (
        <EmptyState title="Koledar je prazen" body="Ko dodate opremo z enotami, vsaka enota dobi svojo vrstico." action={<LinkButton href="/app/inventory/new">Nov artikel</LinkButton>} />
      ) : (
        <Timeline from={base.getTime()} days={days} now={Date.now()} moveAction={moveReservationAction}
          units={units.map((u) => ({ id: u.id, code: u.internal_code, listingId: u.listing_id, listing: u.listing_title, status: u.status }))}
          allocations={allocations.map((a) => ({ id: a.id, unitId: a.unit_id, kind: a.kind, start: new Date(a.starts_at).getTime(), end: new Date(a.ends_at).getTime(), blockedUntil: new Date(a.blocked_until).getTime(), reservationId: a.reservation_id, number: a.number, status: a.status, customer: a.customer, source: a.source, note: a.note }))} />
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-steel" aria-label="Legenda">
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-xs bg-info" />Potrjeno</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-xs border border-dashed border-ink/40 bg-surface" />Čaka potrditev / ponudba</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-xs bg-ink" />V najemu</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-xs bg-bad" />Zamuda</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-xs bg-amber-soft ring-1 ring-amber" />Servis / blokada</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-xs bg-line" />Čas med najemi</li>
      </ul>
    </>
  );
}
