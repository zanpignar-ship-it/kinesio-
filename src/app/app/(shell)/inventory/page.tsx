import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listListings } from "@/server/services/inventory";
import { Badge, EmptyState, inputClass, LinkButton, Money, PageHeader, Table, td, th } from "@/components/ui";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Oprema" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor("inventory.read");
  const { q } = await searchParams;
  const listings = await listListings(actor, { q });
  const units = listings.reduce((s, l) => s + l.unit_count, 0);
  return (
    <>
      <PageHeader title="Oprema" description={`${listings.length} artiklov, ${units} fizičnih enot.`}
        actions={<LinkButton href="/app/inventory/new"><Icon name="plus" className="size-4" />Nov artikel</LinkButton>} />
      <form className="mb-4 flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">Išči opremo</label>
        <input id="q" name="q" defaultValue={q} placeholder="Išči po nazivu, proizvajalcu, modelu" className={inputClass} />
        <button className="h-10 rounded-sm border border-line-strong bg-surface px-3 text-sm hover:border-ink/40">Išči</button>
      </form>
      {listings.length === 0 ? (
        <EmptyState title={q ? "Ni zadetkov" : "Dodajte prvi artikel"}
          body={q ? "Poskusite z drugim izrazom." : "Vnesite stroj ali orodje enkrat; razpoložljivost se nato vodi po posameznih enotah in se samodejno prikaže na tržnici, če artikel objavite."}
          action={!q && <LinkButton href="/app/inventory/new">Nov artikel</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><th className={th}>Artikel</th><th className={th}>Kategorija</th><th className={`${th} text-right`}>Enote</th><th className={`${th} text-right`}>Prosto zdaj</th><th className={`${th} text-right`}>Na dan</th><th className={th}>Tržnica</th></tr></thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-paper">
                <td className={td}>
                  <Link href={`/app/inventory/${l.id}`} className="font-medium text-ink hover:underline">{l.title}</Link>
                  {(l.manufacturer || l.model) && <span className="block text-xs text-steel">{[l.manufacturer, l.model].filter(Boolean).join(" ")}</span>}
                </td>
                <td className={`${td} text-steel`}>{l.category_name.sl}</td>
                <td className={`${td} text-right tabular`}>{l.unit_count}</td>
                <td className={`${td} text-right tabular`}>{l.available_now}</td>
                <td className={`${td} text-right`}><Money cents={l.price_day_cents} /></td>
                <td className={td}>{l.is_published ? <Badge tone="ok">Objavljeno</Badge> : <Badge>Zasebno</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
