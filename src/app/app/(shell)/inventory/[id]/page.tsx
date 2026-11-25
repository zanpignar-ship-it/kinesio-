import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getListing, listCategories } from "@/server/services/inventory";
import { can } from "@/domain/permissions";
import { AssetTag, Badge, fmtDateTime, LinkButton, Money, PageHeader, Panel, Table, td, th, UnitBadge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ListingForm } from "../listing-form";
import { AddUnits } from "./add-units";
import { addUnitsAction, updateListingAction } from "../actions";

export const metadata: Metadata = { title: "Artikel" };

const eur = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const actor = await requireActor("inventory.read");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getListing(actor, id);
  if (!data) notFound();
  const { listing: l, units } = data;
  const canWrite = can(actor.role, "inventory.write");
  const cats = await listCategories();
  return (
    <>
      <PageHeader title={l.title} back={{ href: "/app/inventory", label: "Oprema" }}
        description={<span className="flex flex-wrap items-center gap-2">{l.category_name.sl}{l.is_published ? <Badge tone="ok">Objavljeno na tržnici</Badge> : <Badge>Zasebno</Badge>}</span>}
        actions={<>
          {units.length > 0 && <LinkButton href={`/app/units/labels?listing=${l.id}`} variant="secondary"><Icon name="printer" className="size-4" />QR nalepke</LinkButton>}
          <LinkButton href={`/app/reservations/new?listing=${l.id}`}><Icon name="plus" className="size-4" />Rezerviraj</LinkButton>
        </>} />
      {created && <p role="status" className="mb-6 rounded-sm border border-ok/25 bg-ok-soft px-3 py-2.5 text-sm text-ok">Artikel je dodan. Enote lahko natisnete kot QR nalepke.</p>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Fizične enote <span className="font-normal text-steel">({units.length})</span></h2>
            {units.length === 0 ? <p className="rounded-md border border-dashed border-line-strong p-6 text-sm text-steel">Ta artikel še nima enot. Brez enot ga ni mogoče rezervirati.</p> : (
              <Table>
                <thead><tr><th className={th}>Inventarna št.</th><th className={th}>Serijska št.</th><th className={th}>Stanje</th><th className={th}>Trenutno / naslednje</th></tr></thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id} className="hover:bg-paper">
                      <td className={td}><Link href={`/app/units/${u.id}`} className="hover:opacity-80"><AssetTag code={u.internal_code} /></Link></td>
                      <td className={`${td} font-mono text-xs text-steel`}>{u.serial_number ?? "—"}</td>
                      <td className={td}><UnitBadge status={u.status} /></td>
                      <td className={`${td} text-[13px] text-steel`}>{u.current_reservation ? `V najemu (${u.current_reservation})` : u.next_start ? `Od ${fmtDateTime(u.next_start)}` : "Prosto"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
          {canWrite && (
            <Panel title="Dodaj enote">
              <AddUnits action={addUnitsAction.bind(null, l.id)} />
            </Panel>
          )}
        </div>
        <aside className="space-y-6">
          <Panel title="Cenik">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-steel">Na dan</dt><dd className="text-right font-medium"><Money cents={l.price_day_cents} /></dd>
              {l.price_week_cents != null && <><dt className="text-steel">Na teden</dt><dd className="text-right font-medium"><Money cents={l.price_week_cents} /></dd></>}
              {l.price_month_cents != null && <><dt className="text-steel">Na mesec</dt><dd className="text-right font-medium"><Money cents={l.price_month_cents} /></dd></>}
              <dt className="text-steel">Varščina</dt><dd className="text-right"><Money cents={l.deposit_cents} /></dd>
              <dt className="text-steel">Čas med najemi</dt><dd className="text-right tabular">{l.buffer_minutes / 60} h</dd>
            </dl>
          </Panel>
          {Object.keys(l.specs).length > 0 && (
            <Panel title="Tehnični podatki">
              <dl className="grid grid-cols-2 gap-y-2 text-sm">{Object.entries(l.specs).map(([k, v]) => <Fragment key={k}><dt className="text-steel">{k}</dt><dd className="text-right">{v}</dd></Fragment>)}</dl>
            </Panel>
          )}
        </aside>
      </div>

      {canWrite && (
        <details className="group mt-10 rounded-md border border-line bg-surface">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
            Uredi artikel <Icon name="chevronRight" className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-line p-4 sm:p-6">
            <ListingForm action={updateListingAction.bind(null, l.id)} categories={cats.map((c) => ({ id: c.id, name: c.name_i18n.sl }))}
              defaults={{
                title: l.title, categoryId: l.category_id, manufacturer: l.manufacturer ?? "", model: l.model ?? "", description: l.description,
                specs: Object.entries(l.specs).map(([k, v]) => `${k}: ${v}`).join("\n"), priceDay: eur(l.price_day_cents), priceWeek: eur(l.price_week_cents),
                priceMonth: eur(l.price_month_cents), deposit: eur(l.deposit_cents), bufferHours: String(l.buffer_minutes / 60), bookingMode: l.booking_mode,
                deliveryAvailable: l.delivery_available, isPublished: l.is_published,
              }} />
          </div>
        </details>
      )}
    </>
  );
}
