import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listReservations } from "@/server/services/reservations";
import { cx, EmptyState, fmtDateTime, inputClass, LinkButton, Money, PageHeader, ReservationBadge, Table, td, th } from "@/components/ui";
import { Icon } from "@/components/icons";
import { t } from "@/i18n";
import type { ReservationSource } from "@/domain/reservation";

export const metadata: Metadata = { title: "Rezervacije" };

const SCOPES = [["upcoming", "Prihajajoče"], ["active", "V najemu"], ["past", "Pretekle"], ["all", "Vse"]] as const;

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ scope?: string; q?: string }> }) {
  const actor = await requireActor("reservations.read");
  const sp = await searchParams;
  const scope = (SCOPES.find(([k]) => k === sp.scope)?.[0] ?? "upcoming") as (typeof SCOPES)[number][0];
  const rows = await listReservations(actor, { scope, q: sp.q });
  return (
    <>
      <PageHeader title="Rezervacije" actions={<LinkButton href="/app/reservations/new"><Icon name="plus" className="size-4" />Nova rezervacija</LinkButton>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Obdobje" className="inline-flex rounded-sm bg-sunken p-0.5 text-[13px]">
          {SCOPES.map(([k, l]) => (
            <Link key={k} href={`/app/reservations?scope=${k}`} aria-current={scope === k ? "page" : undefined}
              className={cx("h-8 rounded-xs px-3 leading-8", scope === k ? "bg-surface font-medium shadow-raise" : "text-steel hover:text-ink")}>{l}</Link>
          ))}
        </nav>
        <form role="search" className="sm:w-72">
          <input type="hidden" name="scope" value={scope} />
          <label htmlFor="rq" className="sr-only">Išči rezervacije</label>
          <input id="rq" name="q" defaultValue={sp.q} placeholder="Številka ali stranka" className={inputClass} />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Ni rezervacij" body={scope === "upcoming" ? "Ustvarite rezervacijo za telefonsko stranko ali stranko v poslovalnici." : "V tem pogledu ni zapisov."}
          action={<LinkButton href="/app/reservations/new">Nova rezervacija</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><th className={th}>Številka</th><th className={th}>Stranka</th><th className={th}>Termin</th><th className={th}>Oprema</th><th className={th}>Vir</th><th className={`${th} text-right`}>Znesek</th><th className={th}>Stanje</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-paper">
                <td className={td}><Link href={`/app/reservations/${r.id}`} className="font-medium hover:underline">{r.number}</Link></td>
                <td className={td}><Link href={`/app/customers/${r.customer_id}`} className="hover:underline">{r.customer_name}</Link></td>
                <td className={`${td} text-[13px] tabular text-steel`}>{fmtDateTime(r.starts_at)}<br />{fmtDateTime(r.ends_at)}</td>
                <td className={`${td} max-w-64 truncate text-[13px]`} title={r.items_summary}>{r.items_summary}</td>
                <td className={`${td} text-[13px] text-steel`}>{t(`src.${r.source as ReservationSource}`)}</td>
                <td className={`${td} text-right`}><Money cents={r.total_cents} /></td>
                <td className={td}><ReservationBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
