import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listCategories } from "@/server/services/inventory";
import { PageHeader } from "@/components/ui";
import { ListingForm } from "../listing-form";
import { createListingAction } from "../actions";

export const metadata: Metadata = { title: "Nov artikel" };

export default async function NewListingPage() {
  await requireActor("inventory.write");
  const cats = await listCategories();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nov artikel opreme" back={{ href: "/app/inventory", label: "Oprema" }}
        description="Artikel je to, kar ponujate (npr. »Bager 1,8 t«). Pod njim vodite vse fizične kose s svojimi inventarnimi številkami." />
      <ListingForm isNew action={createListingAction} categories={cats.map((c) => ({ id: c.id, name: c.name_i18n.sl }))} />
    </div>
  );
}
