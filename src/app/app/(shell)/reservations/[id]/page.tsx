import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getReservation } from "@/server/services/reservations";
import { listUnits } from "@/server/services/inventory";
import { can } from "@/domain/permissions";
import { reservationMachine, isCommissionable, type ReservationStatus, type ReservationSource } from "@/domain/reservation";
import { AssetTag, fmtDateTime, Money, PageHeader, Panel, ReservationBadge, UnitBadge } from "@/components/ui";
import { dateToLocal } from "@/lib/datetime";
import { t } from "@/i18n";
import { ReassignForm, RescheduleForm, TransitionButtons } from "./controls";
import { reassignAction, rescheduleAction, transitionAction } from "../actions";

export const metadata: Metadata = { title: "Rezervacija" };

const PRIMARY: Partial<Record<ReservationStatus, ReservationStatus>> = {
  draft: "confirmed", quotation: "confirmed", awaiting_confirmation: "confirmed", confirmed: "active", awaiting_pickup: "active",
  active: "inspection", awaiting_return: "inspection", overdue: "inspection", inspection: "completed", disputed: "completed",
};
const EVENT: Record<string, string> = { "reservation.created": "Ustvarjena", "reservation.status_changed": "Sprememba stanja", "reservation.rescheduled": "Spremenjen termin", "allocation.reassigned": "Zamenjana enota" };

export default async function ReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const actor = await requireActor("reservations.read");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getReservation(actor, id);
  if (!data) notFound();
  const { reservation: r, items, allocations, events } = data;
  const canWrite = can(actor.role, "reservations.write");
  const next = reservationMachine.next(r.status).filter((s) => s !== "cancelled" || can(actor.role, "reservations.cancel"));
  const options = canWrite ? next.map((to) => ({ to, label: t(`ra.${to}`), tone: (PRIMARY[r.status] === to ? "primary" : to === "cancelled" || to === "disputed" ? "danger" : "secondary") as "primary" | "secondary" | "danger" }))
    .sort((a, b) => (a.tone === "primary" ? -1 : b.tone === "primary" ? 1 : a.tone === "danger" ? 1 : -1)) : [];
  const units = canWrite ? await listUnits(actor) : [];
  const reschedulable = ["draft", "quotation", "awaiting_confirmation", "confirmed", "awaiting_pickup", "active"].includes(r.status);

  return (
    <>
      <PageHeader title={r.number} back={{ href: "/app/reservations", label: "Rezervacije" }}
        description={<span className="flex flex-wrap items-center gap-2"><ReservationBadge status={r.status} /><span>{t(`src.${r.source as ReservationSource}`)}</span>{isCommissionable(r.source as ReservationSource) && <span className="text-xs">(provizija tržnice)</span>}</span>} />
      {created && <p role="status" className="mb-6 rounded-sm border border-ok/25 bg-ok-soft px-3 py-2.5 text-sm text-ok">Rezervacija je ustvarjena in enote so zasedene v koledarju.</p>}

      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Naslednji korak"><TransitionButtons action={transitionAction.bind(null, r.id)} options={options} /></Panel>
          <Panel title="Oprema in enote" padded={false}>
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <li key={it.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/app/inventory/${it.listing_id}`} className="text-sm font-medium hover:underline">{it.quantity}× {it.title}</Link>
                    <span className="text-sm"><span className="mr-3 text-xs text-steel">{it.pricing_basis}</span><Money cents={it.line_total_cents} /></span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {allocations.filter((a) => a.item_id === it.id && a.active).map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-3">
                        <Link href={`/app/units/${a.unit_id}`}><AssetTag code={a.internal_code} /></Link>
                        <UnitBadge status={a.unit_status} />
                        {canWrite && reschedulable && (
                          <ReassignForm action={reassignAction.bind(null, r.id, a.id)} current={a.unit_id}
                            options={units.filter((u) => u.listing_id === it.listing_id && !["retired", "damaged", "unavailable"].includes(u.status)).map((u) => ({ id: u.id, code: u.internal_code }))} />
                        )}
                      </li>
                    ))}
                    {!allocations.some((a) => a.item_id === it.id && a.active) && <li className="text-xs text-steel">Enote so sproščene.</li>}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>
          {r.notes && <Panel title="Opombe"><p className="text-sm whitespace-pre-line">{r.notes}</p></Panel>}
          <Panel title="Zgodovina" padded={false}>
            <ol className="divide-y divide-line">
              {events.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-3 px-4 py-2.5 text-sm">
                  <span className="w-36 text-xs text-steel tabular">{fmtDateTime(e.created_at)}</span>
                  <span className="flex-1">{EVENT[e.action] ?? e.action}
                    {typeof e.data.to === "string" && <span className="text-steel">: {t(`rs.${e.data.from as ReservationStatus}`)} → {t(`rs.${e.data.to as ReservationStatus}`)}</span>}
                  </span>
                  <span className="text-xs text-steel">{e.actor}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="Stranka">
            <Link href={`/app/customers/${r.customer_id}`} className="font-medium hover:underline">{r.customer_name}</Link>
            {r.customer_phone && <p className="mt-1 text-sm"><a href={`tel:${r.customer_phone.replace(/\s/g, "")}`} className="underline underline-offset-2">{r.customer_phone}</a></p>}
            {r.customer_email && <p className="text-sm text-steel">{r.customer_email}</p>}
          </Panel>
          <Panel title="Termin">
            <dl className="space-y-1 text-sm"><div className="flex justify-between"><dt className="text-steel">Prevzem</dt><dd className="tabular">{fmtDateTime(r.starts_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-steel">Vračilo</dt><dd className="tabular">{fmtDateTime(r.ends_at)}</dd></div></dl>
            {canWrite && reschedulable && <div className="mt-4 border-t border-line pt-4"><RescheduleForm action={rescheduleAction.bind(null, r.id)} start={dateToLocal(new Date(r.starts_at))} end={dateToLocal(new Date(r.ends_at))} /></div>}
          </Panel>
          <Panel title="Znesek">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-steel">Najemnina</dt><dd><Money cents={r.subtotal_cents} /></dd></div>
              {r.discount_cents > 0 && <div className="flex justify-between"><dt className="text-steel">Popust</dt><dd>−<Money cents={r.discount_cents} /></dd></div>}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Skupaj z DDV</dt><dd><Money cents={r.total_cents} /></dd></div>
              <div className="flex justify-between"><dt className="text-steel">Varščina</dt><dd><Money cents={r.deposit_cents} /></dd></div>
            </dl>
            <p className="mt-3 text-xs text-mute">Plačila, varščine in računi bodo vodeni v modulu financ (v pripravi).</p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
