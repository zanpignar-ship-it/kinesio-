"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/session";
import { addUnits, createListing, generateCodes, nextCodeNumber, updateListing } from "@/server/services/inventory";
import { bool, optStr, str, toActionState, type ActionState } from "@/server/action";
import { parseMoneyToCents } from "@/domain/money";

function parseSpecs(raw: string) {
  const specs: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim().slice(0, 80);
      const v = line.slice(i + 1).trim().slice(0, 200);
      if (k && v) specs[k] = v;
    }
  }
  return specs;
}

function money(fd: FormData, k: string, required = false): number | null | undefined {
  const raw = str(fd, k);
  if (!raw) return required ? undefined : null;
  const c = parseMoneyToCents(raw);
  return c === null ? undefined : c;
}

function listingInput(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const priceDay = money(fd, "priceDay", true);
  const priceWeek = money(fd, "priceWeek");
  const priceMonth = money(fd, "priceMonth");
  const deposit = money(fd, "deposit");
  if (priceDay === undefined) fieldErrors.priceDay = "Vnesite dnevno ceno, npr. 35 ali 35,50.";
  if (priceWeek === undefined) fieldErrors.priceWeek = "Neveljaven znesek.";
  if (priceMonth === undefined) fieldErrors.priceMonth = "Neveljaven znesek.";
  if (deposit === undefined) fieldErrors.deposit = "Neveljaven znesek.";
  const bufferHours = Number(str(fd, "bufferHours") || 0);
  if (!Number.isFinite(bufferHours) || bufferHours < 0 || bufferHours > 168) fieldErrors.bufferHours = "Od 0 do 168 ur.";
  return {
    fieldErrors,
    input: {
      title: str(fd, "title"),
      categoryId: str(fd, "categoryId"),
      manufacturer: optStr(fd, "manufacturer"),
      model: optStr(fd, "model"),
      description: str(fd, "description"),
      specs: parseSpecs(str(fd, "specs")),
      priceDayCents: priceDay ?? 0,
      priceWeekCents: priceWeek ?? null,
      priceMonthCents: priceMonth ?? null,
      depositCents: deposit ?? 0,
      bufferMinutes: Math.round(bufferHours * 60),
      bookingMode: (str(fd, "bookingMode") === "instant" ? "instant" : "request") as "instant" | "request",
      deliveryAvailable: bool(fd, "deliveryAvailable"),
      isPublished: bool(fd, "isPublished"),
    },
  };
}

const fieldMap: Record<string, string> = { priceDayCents: "priceDay", categoryId: "categoryId", title: "title" };

function remap(state: ActionState): ActionState {
  if (!state?.fieldErrors) return state;
  return { ...state, fieldErrors: Object.fromEntries(Object.entries(state.fieldErrors).map(([k, v]) => [fieldMap[k] ?? k, v])) };
}

export async function createListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("inventory.write");
  const { input, fieldErrors } = listingInput(fd);
  if (Object.keys(fieldErrors).length) return { error: "Preverite označena polja.", fieldErrors };
  let id: string;
  try {
    const l = await createListing(actor, input);
    id = l.id;
    const count = Math.min(200, Math.max(0, Number(str(fd, "unitCount") || 0)));
    const prefix = str(fd, "codePrefix");
    if (count > 0) {
      const start = await nextCodeNumber(actor, prefix || "ENOTA");
      await addUnits(actor, id, generateCodes(prefix || "ENOTA", start, count).map((internalCode) => ({ internalCode })));
    }
  } catch (e) {
    return remap(toActionState(e));
  }
  revalidatePath("/app/inventory");
  redirect(`/app/inventory/${id}?created=1`);
}

export async function updateListingAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("inventory.write");
  const { input, fieldErrors } = listingInput(fd);
  if (Object.keys(fieldErrors).length) return { error: "Preverite označena polja.", fieldErrors };
  try {
    await updateListing(actor, id, input);
  } catch (e) {
    return remap(toActionState(e));
  }
  revalidatePath(`/app/inventory/${id}`);
  return { ok: true, message: "Spremembe so shranjene." };
}

export async function addUnitsAction(listingId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("inventory.write");
  try {
    const mode = str(fd, "mode");
    let units: { internalCode: string; serialNumber?: string | null }[];
    if (mode === "list") {
      units = str(fd, "codes").split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const [code, serial] = line.split(/[;,\t]/).map((s) => s.trim());
        return { internalCode: code, serialNumber: serial || null };
      });
    } else {
      const prefix = str(fd, "prefix") || "ENOTA";
      const count = Number(str(fd, "count"));
      if (!Number.isInteger(count) || count < 1 || count > 200) return { error: "Vnesite število enot od 1 do 200.", fieldErrors: { count: "Od 1 do 200." } };
      const start = await nextCodeNumber(actor, prefix);
      units = generateCodes(prefix, start, count).map((internalCode) => ({ internalCode }));
    }
    const created = await addUnits(actor, listingId, units);
    revalidatePath(`/app/inventory/${listingId}`);
    return { ok: true, message: created.length === 1 ? "Dodana je 1 enota." : `Dodanih je ${created.length} enot.` };
  } catch (e) {
    return toActionState(e);
  }
}
