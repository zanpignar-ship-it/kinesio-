import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";
import { createCustomerAction } from "../actions";

export const metadata: Metadata = { title: "Nova stranka" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireActor("customers.write");
  const { next } = await searchParams;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nova stranka" back={{ href: next?.startsWith("/app/") ? next : "/app/customers", label: next ? "Nazaj na rezervacijo" : "Stranke" }}
        description="Zberite le podatke, ki jih potrebujete za najem in račun." />
      <CustomerForm action={createCustomerAction} submitLabel="Dodaj stranko" next={next} />
    </div>
  );
}
