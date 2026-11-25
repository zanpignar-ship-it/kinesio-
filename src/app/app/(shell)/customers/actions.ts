"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/session";
import { createCustomer, updateCustomer } from "@/server/services/customers";
import { bool, optStr, str, toActionState, type ActionState } from "@/server/action";

function input(fd: FormData) {
  return {
    kind: (str(fd, "kind") === "business" ? "business" : "individual") as "business" | "individual",
    name: str(fd, "name"),
    companyName: optStr(fd, "companyName"),
    taxId: optStr(fd, "taxId"),
    email: optStr(fd, "email"),
    phone: optStr(fd, "phone"),
    address: optStr(fd, "address"),
    notes: optStr(fd, "notes"),
    discountPercent: Number((str(fd, "discountPercent") || "0").replace(",", ".")),
    marketingConsent: bool(fd, "marketingConsent"),
  };
}

export async function createCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("customers.write");
  let id: string;
  try {
    id = (await createCustomer(actor, input(fd))).id;
  } catch (e) {
    return toActionState(e);
  }
  const next = str(fd, "next");
  redirect(next.startsWith("/app/reservations/new") ? `${next}${next.includes("?") ? "&" : "?"}customer=${id}` : `/app/customers/${id}`);
}

export async function updateCustomerAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("customers.write");
  try {
    await updateCustomer(actor, id, input(fd));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/app/customers/${id}`);
  return { ok: true, message: "Podatki stranke so shranjeni." };
}
