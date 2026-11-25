import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listListings } from "@/server/services/inventory";
import { listCustomers } from "@/server/services/customers";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { RESERVATION_SOURCES } from "@/domain/reservation";
import { dateToLocal } from "@/lib/datetime";
import { t } from "@/i18n";
import { ReservationBuilder } from "./builder";
import { createReservationAction, quoteAction } from "../actions";

export const metadata: Metadata = { title: "Nova rezervacija" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ listing?: string; customer?: string; start?: string }> }) {
  const actor = await requireActor("reservations.write");
  const sp = await searchParams;
  const [listings, customers] = await Promise.all([listListings(actor), listCustomers(actor, { limit: 1000 })]);
  const start = sp.start && !Number.isNaN(Date.parse(sp.start)) ? new Date(sp.start) : (() => { const d = new Date(Date.now() + 86400000); d.setUTCHours(6, 0, 0, 0); return d; })();
  const end = new Date(start.getTime() + 86400000);
  if (listings.length === 0) {
    return (<><PageHeader title="Nova rezervacija" back={{ href: "/app/reservations", label: "Rezervacije" }} />
      <EmptyState title="Najprej dodajte opremo" body="Rezervacija potrebuje vsaj en artikel z eno fizično enoto." action={<LinkButton href="/app/inventory/new">Nov artikel</LinkButton>} /></>);
  }
  return (
    <>
      <PageHeader title="Nova rezervacija" back={{ href: "/app/reservations", label: "Rezervacije" }} />
      <ReservationBuilder
        listings={listings.map((l) => ({ id: l.id, title: l.title, units: l.unit_count, depositCents: l.deposit_cents }))}
        customers={customers.map((c) => ({ id: c.id, label: c.company_name ? `${c.company_name} (${c.name})` : c.name, discount: Number(c.discount_percent) }))}
        sources={RESERVATION_SOURCES.filter((s) => s !== "marketplace" && s !== "api").map((s) => ({ value: s, label: t(`src.${s}`) }))}
        defaults={{ start: dateToLocal(start), end: dateToLocal(end), listingId: listings.some((l) => l.id === sp.listing) ? sp.listing : undefined, customerId: customers.some((c) => c.id === sp.customer) ? sp.customer : undefined }}
        createAction={createReservationAction} quoteAction={quoteAction} />
    </>
  );
}
