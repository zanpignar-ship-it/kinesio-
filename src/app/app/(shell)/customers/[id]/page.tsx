import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getCustomer } from "@/server/services/customers";
import { can } from "@/domain/permissions";
import { fmtDate, fmtDateTime, LinkButton, Money, PageHeader, Panel, ReservationBadge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { t } from "@/i18n";
import type { ReservationStatus, ReservationSource } from "@/domain/reservation";
import { CustomerForm } from "../customer-form";
import { updateCustomerAction } from "../actions";

export const metadata: Metadata = { title: "Stranka" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("customers.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getCustomer(actor, id);
  if (!data) notFound();
  const { customer: c, reservations } = data;
  const lifetime = reservations.filter((r) => !["cancelled", "expired", "draft", "quotation"].includes(r.status)).reduce((s, r) => s + r.total_cents, 0);
  return (
    <>
      <PageHeader title={c.company_name ?? c.name} back={{ href: "/app/customers", label: "Stranke" }}
        description={c.company_name ? `${c.name}${c.tax_id ? `, ${c.tax_id}` : ""}` : `Stranka od ${fmtDate(c.created_at)}`}
        actions={can(actor.role, "reservations.write") && <LinkButton href={`/app/reservations/new?customer=${c.id}`}><Icon name="plus" className="size-4" />Nova rezervacija</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title={`Rezervacije (${reservations.length})`} action={<span className="text-sm text-steel">Skupaj <Money cents={lifetime} /></span>} padded={false}>
          {reservations.length === 0 ? <p className="p-4 text-sm text-steel">Stranka še nima rezervacij.</p> : (
            <ul className="divide-y divide-line">
              {reservations.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/reservations/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-paper">
                    <span className="w-32 font-medium">{r.number}</span>
                    <span className="flex-1 text-steel tabular">{fmtDateTime(r.starts_at)} – {fmtDateTime(r.ends_at)}</span>
                    <span className="text-xs text-steel">{t(`src.${r.source as ReservationSource}`)}</span>
                    <Money cents={r.total_cents} />
                    <ReservationBadge status={r.status as ReservationStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Podatki">
          {can(actor.role, "customers.write") ? (
            <CustomerForm action={updateCustomerAction.bind(null, c.id)} submitLabel="Shrani spremembe" defaults={{
              kind: c.kind, name: c.name, companyName: c.company_name ?? "", taxId: c.tax_id ?? "", email: c.email ?? "", phone: c.phone ?? "",
              address: c.address ?? "", notes: c.notes ?? "", discountPercent: String(Number(c.discount_percent)), marketingConsent: c.marketing_consent,
            }} />
          ) : (
            <dl className="space-y-2 text-sm"><dt className="text-steel">Telefon</dt><dd>{c.phone ?? "—"}</dd><dt className="text-steel">E-pošta</dt><dd>{c.email ?? "—"}</dd></dl>
          )}
          {c.marketing_consent_at && <p className="mt-4 text-xs text-steel">Soglasje za obvestila: {fmtDateTime(c.marketing_consent_at)}</p>}
        </Panel>
      </div>
    </>
  );
}
