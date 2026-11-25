import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getUnit } from "@/server/services/inventory";
import { qrSvg } from "@/server/services/passport";
import { can } from "@/domain/permissions";
import { unitMachine } from "@/domain/unit";
import { AssetTag, fmtDate, fmtDateTime, LinkButton, Money, Panel, ReservationBadge, UnitBadge } from "@/components/ui";
import { PassportReveal } from "@/components/passport";
import { EquipmentGlyph } from "@/components/equipment-glyph";
import { Icon } from "@/components/icons";
import { dateToLocal } from "@/lib/datetime";
import { t } from "@/i18n";
import type { ReservationStatus } from "@/domain/reservation";
import { StatusForm, BlockForm } from "../unit-forms";
import { changeStatusAction, createBlockAction, removeBlockAction } from "../actions";

export const metadata: Metadata = { title: "Potni list enote" };

export default async function UnitPassportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ scan?: string }> }) {
  const actor = await requireActor("inventory.read");
  const { id } = await params;
  const { scan } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getUnit(actor, id);
  if (!data) notFound();
  const { unit: u, history, allocations, stats } = data;
  const svg = await qrSvg(u.qr_token);
  const now = Date.now();
  // A unit physically out on rent (incl. overdue) is "current" even after its planned end.
  const current = allocations.find((a) => a.status && ["active", "awaiting_return", "overdue"].includes(a.status))
    ?? allocations.find((a) => new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() > now && a.status !== "completed");
  const next = [...allocations].filter((a) => new Date(a.starts_at).getTime() > now && a.id !== current?.id).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  const roi = u.purchase_price_cents ? Math.round((stats.revenue_cents / u.purchase_price_cents) * 100) : null;
  const options = unitMachine.next(u.status).map((s) => ({ value: s, label: t(`us.${s}`) }));
  const showFinance = can(actor.role, "finance.read");
  const tomorrow = new Date(now + 86400000); tomorrow.setMinutes(0, 0, 0);

  return (
    <PassportReveal fromScan={!!scan}>
      <div data-pass="scanline" aria-hidden className="pointer-events-none fixed inset-x-0 top-1/3 z-50 h-0.5 origin-left bg-amber opacity-0" />
      {scan && <p role="status" className="sr-only">Enota {u.internal_code} je prepoznana.</p>}
      <Link href={`/app/inventory/${u.listing_id}`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-steel hover:text-ink"><span aria-hidden>‹</span> {u.listing_title}</Link>

      <section className="grid overflow-hidden rounded-md border border-line bg-surface md:grid-cols-[minmax(0,280px)_1fr]">
        <div data-pass="figure" className="relative grid place-items-center bg-sunken p-8 text-ink-2">
          <EquipmentGlyph className="w-full max-w-[220px]" />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span data-pass="tag"><AssetTag code={u.internal_code} size="lg" /></span>
            <span data-pass="status"><UnitBadge status={u.status} /></span>
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{u.listing_title}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-steel">Serijska št.</dt><dd className="font-mono text-[13px]">{u.serial_number ?? "—"}</dd></div>
            <div><dt className="text-xs text-steel">Lokacija</dt><dd>{u.location_name ?? "—"}</dd></div>
            <div><dt className="text-xs text-steel">Delovne ure</dt><dd className="tabular">{u.operating_hours ?? "—"}</dd></div>
            <div><dt className="text-xs text-steel">Trenutno</dt><dd>{current ? (current.number ? <Link className="underline underline-offset-2" href={`/app/reservations/${current.reservation_id}`}>{current.number}, {current.customer}</Link> : current.kind === "maintenance" ? "Servis" : "Blokirano") : "Prosto"}</dd></div>
            <div><dt className="text-xs text-steel">Naslednja rezervacija</dt><dd>{next ? fmtDateTime(next.starts_at) : "—"}</dd></div>
            <div><dt className="text-xs text-steel">Najemov skupaj</dt><dd className="tabular">{stats.rentals}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {current?.reservation_id && <span data-pass="action"><LinkButton href={`/app/reservations/${current.reservation_id}`}>Odpri najem</LinkButton></span>}
            {next?.reservation_id && <span data-pass="action"><LinkButton href={`/app/reservations/${next.reservation_id}`} variant={current ? "secondary" : "primary"}>Naslednja rezervacija</LinkButton></span>}
            <span data-pass="action"><LinkButton href={`/app/reservations/new?listing=${u.listing_id}`} variant="secondary"><Icon name="plus" className="size-4" />Rezerviraj</LinkButton></span>
            <span data-pass="action"><LinkButton href={`/app/units/labels?unit=${u.id}`} variant="ghost"><Icon name="printer" className="size-4" />Nalepka</LinkButton></span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div data-pass="section">
            <Panel title="Termini" padded={false}>
              {allocations.length === 0 ? <p className="p-4 text-sm text-steel">Ni rezervacij ali servisov.</p> : (
                <ul className="divide-y divide-line">
                  {allocations.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                      <span className="w-full tabular text-steel sm:w-64">{fmtDateTime(a.starts_at)} – {fmtDateTime(a.ends_at)}</span>
                      {a.reservation_id ? (
                        <Link href={`/app/reservations/${a.reservation_id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                          <span className="font-medium">{a.number}</span><span className="truncate text-steel">{a.customer}</span>
                        </Link>
                      ) : (
                        <span className="flex-1">{a.kind === "maintenance" ? "Servis" : "Blokirano"}{a.note && <span className="text-steel">: {a.note}</span>}</span>
                      )}
                      {a.status ? <ReservationBadge status={a.status as ReservationStatus} /> : can(actor.role, "inventory.write") && (
                        <form action={removeBlockAction.bind(null, u.id, a.id)}><button className="text-[13px] text-steel underline underline-offset-2 hover:text-bad">Odstrani</button></form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <div data-pass="section">
            <Panel title="Zgodovina stanj" padded={false}>
              <ol className="divide-y divide-line">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="w-36 text-xs text-steel tabular">{fmtDateTime(h.created_at)}</span>
                    <UnitBadge status={h.to_status} />
                    <span className="min-w-0 flex-1 truncate text-steel">{h.reason}{h.actor && <> ({h.actor})</>}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
        <aside className="space-y-6">
          <div data-pass="section">
            <Panel title="QR potni list">
              <div className="mx-auto w-40 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="mt-3 text-xs text-steel">Skeniranje prikaže ta potni list samo prijavljenim sodelavcem. Drugi vidijo le naziv opreme in kontakt izposojevalnice.</p>
            </Panel>
          </div>
          {can(actor.role, "units.status") && (
            <div data-pass="section"><Panel title="Spremeni stanje"><StatusForm action={changeStatusAction.bind(null, u.id)} options={options} /></Panel></div>
          )}
          {(can(actor.role, "maintenance.write") || can(actor.role, "inventory.write")) && (
            <div data-pass="section">
              <Panel title="Servis ali blokada">
                <BlockForm action={createBlockAction.bind(null, u.id)} defaults={{ start: dateToLocal(tomorrow), end: dateToLocal(new Date(tomorrow.getTime() + 86400000)) }} />
              </Panel>
            </div>
          )}
          {showFinance && (
            <div data-pass="section">
              <Panel title="Ekonomika">
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-steel">Nabavna cena</dt><dd className="text-right">{u.purchase_price_cents != null ? <Money cents={u.purchase_price_cents} /> : "—"}</dd>
                  <dt className="text-steel">Datum nabave</dt><dd className="text-right">{u.purchase_date ? fmtDate(u.purchase_date) : "—"}</dd>
                  <dt className="text-steel">Rezervirana vrednost</dt><dd className="text-right"><Money cents={stats.revenue_cents} /></dd>
                  <dt className="text-steel">Povrnjeno</dt><dd className="text-right tabular">{roi == null ? "—" : `${roi} %`}</dd>
                </dl>
                <p className="mt-3 text-xs text-mute">Stroški servisov bodo upoštevani, ko bo na voljo modul vzdrževanja.</p>
              </Panel>
            </div>
          )}
        </aside>
      </div>
    </PassportReveal>
  );
}
