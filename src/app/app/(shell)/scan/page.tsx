import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { PageHeader } from "@/components/ui";
import { Scanner } from "./scanner";
import { lookupAction } from "./actions";

export const metadata: Metadata = { title: "Skeniraj" };

export default async function ScanPage() {
  await requireActor("inventory.read");
  return (
    <div className="max-w-xl">
      <PageHeader title="Skeniraj opremo" description="Odpre potni list enote: stanje, trenutni najem, naslednjo rezervacijo in dejanja." />
      <Scanner action={lookupAction} />
    </div>
  );
}
