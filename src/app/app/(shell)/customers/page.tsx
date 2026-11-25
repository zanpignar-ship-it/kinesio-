import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listCustomers } from "@/server/services/customers";
import { Badge, EmptyState, fmtDate, inputClass, LinkButton, Money, PageHeader, Table, td, th } from "@/components/ui";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Stranke" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor("customers.read");
  const { q } = await searchParams;
  const customers = await listCustomers(actor, { q });
  return (
    <>
      <PageHeader title="Stranke" description={`${customers.length} strank.`} actions={<LinkButton href="/app/customers/new"><Icon name="plus" className="size-4" />Nova stranka</LinkButton>} />
      <form role="search" className="mb-4 flex max-w-md gap-2">
        <label htmlFor="cq" className="sr-only">Išči stranke</label>
        <input id="cq" name="q" defaultValue={q} placeholder="Ime, podjetje, e-pošta ali telefon" className={inputClass} />
        <button className="h-10 rounded-sm border border-line-strong bg-surface px-3 text-sm hover:border-ink/40">Išči</button>
      </form>
      {customers.length === 0 ? (
        <EmptyState title={q ? "Ni zadetkov" : "Še nimate strank"} body={q ? undefined : "Stranko dodate tukaj ali neposredno med ustvarjanjem rezervacije."}
          action={!q && <LinkButton href="/app/customers/new">Nova stranka</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><th className={th}>Stranka</th><th className={th}>Kontakt</th><th className={`${th} text-right`}>Rezervacije</th><th className={th}>Zadnji najem</th><th className={`${th} text-right`}>Skupna vrednost</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-paper">
                <td className={td}>
                  <Link href={`/app/customers/${c.id}`} className="font-medium hover:underline">{c.company_name ?? c.name}</Link>
                  <span className="ml-2">{c.kind === "business" && <Badge dot={false}>Podjetje</Badge>}</span>
                  {c.company_name && <span className="block text-xs text-steel">{c.name}</span>}
                </td>
                <td className={`${td} text-[13px] text-steel`}>{c.phone ?? ""}{c.phone && c.email && <br />}{c.email ?? ""}</td>
                <td className={`${td} text-right tabular`}>{c.reservations}</td>
                <td className={`${td} text-steel`}>{c.last_rental ? fmtDate(c.last_rental) : "—"}</td>
                <td className={`${td} text-right`}><Money cents={c.lifetime_cents} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
