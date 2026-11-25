import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listUnits } from "@/server/services/inventory";
import { AssetTag, cx, EmptyState, fmtDateTime, inputClass, LinkButton, PageHeader, Table, td, th, UnitBadge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { UNIT_STATUSES, type UnitStatus } from "@/domain/unit";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Enote" };

export default async function UnitsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const actor = await requireActor("inventory.read");
  const sp = await searchParams;
  const status = (UNIT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as UnitStatus) : undefined;
  const units = await listUnits(actor, { status, q: sp.q });
  const chips: (UnitStatus | undefined)[] = [undefined, "available", "rented", "awaiting_return", "inspection", "maintenance", "damaged"];
  return (
    <>
      <PageHeader title="Enote" description="Vsak fizični kos opreme s svojo inventarno številko, stanjem in QR potnim listom."
        actions={units.length > 0 && <LinkButton variant="secondary" href={`/app/units/labels${status ? `?status=${status}` : ""}`}><Icon name="printer" className="size-4" />Natisni nalepke</LinkButton>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter stanja" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {chips.map((c) => (
            <Link key={c ?? "all"} href={c ? `/app/units?status=${c}` : "/app/units"} aria-current={status === c ? "page" : undefined}
              className={cx("h-8 shrink-0 rounded-sm px-3 text-[13px] leading-8", status === c ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:ring-line-strong")}>
              {c ? t(`us.${c}`) : "Vse"}
            </Link>
          ))}
        </nav>
        <form role="search" className="flex gap-2 lg:w-80">
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="uq" className="sr-only">Išči enote</label>
          <input id="uq" name="q" defaultValue={sp.q} placeholder="Inventarna ali serijska številka" className={inputClass} />
        </form>
      </div>
      {units.length === 0 ? (
        <EmptyState title="Ni enot" body={status || sp.q ? "Noben zapis ne ustreza filtru." : "Enote dodate pri posameznem artiklu opreme."} action={!status && !sp.q && <LinkButton href="/app/inventory">Odpri opremo</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><th className={th}>Enota</th><th className={th}>Artikel</th><th className={th}>Stanje</th><th className={th}>Lokacija</th><th className={th}>Trenutno / naslednje</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="hover:bg-paper">
                <td className={td}><Link href={`/app/units/${u.id}`}><AssetTag code={u.internal_code} /></Link></td>
                <td className={td}><Link href={`/app/units/${u.id}`} className="hover:underline">{u.listing_title}</Link>{u.serial_number && <span className="block font-mono text-[11px] text-steel">{u.serial_number}</span>}</td>
                <td className={td}><UnitBadge status={u.status} /></td>
                <td className={`${td} text-steel`}>{u.location_name ?? "—"}</td>
                <td className={`${td} text-[13px] text-steel`}>{u.current_reservation ? `V najemu (${u.current_reservation})` : u.next_start ? `Od ${fmtDateTime(u.next_start)}` : "Prosto"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
