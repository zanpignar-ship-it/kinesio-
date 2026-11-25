"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/session";
import { checkAvailability, createReservation, reassignAllocation, rescheduleReservation, transitionReservation } from "@/server/services/reservations";
import { str, toActionState, type ActionState } from "@/server/action";
import { RESERVATION_SOURCES, RESERVATION_STATUSES, type ReservationSource, type ReservationStatus } from "@/domain/reservation";
import { localToDate } from "@/lib/datetime";

export type QuoteResult = { listingId: string; available: number; unitPriceCents: number; days: number }[] | { error: string };

export async function quoteAction(listingIds: string[], start: string, end: string): Promise<QuoteResult> {
  const actor = await requireActor("reservations.read");
  const s = localToDate(start);
  const e = localToDate(end);
  if (!s || !e || e <= s) return { error: "Izberite veljaven začetek in konec." };
  try {
    return await Promise.all(listingIds.slice(0, 50).map(async (id) => {
      const r = await checkAvailability(actor, id, s, e);
      return { listingId: id, available: r.available, unitPriceCents: r.quote.totalCents, days: r.quote.days };
    }));
  } catch (err) {
    return { error: toActionState(err)?.error ?? "Napaka" };
  }
}

export async function createReservationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("reservations.write");
  const startsAt = localToDate(str(fd, "start"));
  const endsAt = localToDate(str(fd, "end"));
  if (!startsAt || !endsAt) return { error: "Izberite začetek in konec najema.", fieldErrors: { ...(!startsAt && { start: "Obvezno." }), ...(!endsAt && { end: "Obvezno." }) } };
  const ids = fd.getAll("listingId").map(String);
  const qty = fd.getAll("quantity").map((q) => Number(q));
  const items = ids.map((listingId, i) => ({ listingId, quantity: qty[i] })).filter((i) => i.listingId && i.quantity > 0);
  if (!items.length) return { error: "Dodajte vsaj en artikel." };
  const source = str(fd, "source");
  const status = str(fd, "status");
  let id: string;
  try {
    const r = await createReservation(actor, {
      customerId: str(fd, "customerId"),
      source: (RESERVATION_SOURCES as readonly string[]).includes(source) ? (source as ReservationSource) : "direct",
      status: (["draft", "quotation", "awaiting_confirmation", "confirmed"].includes(status) ? status : "confirmed") as "confirmed",
      startsAt, endsAt, notes: str(fd, "notes") || null, items,
    });
    id = r.id;
  } catch (e) {
    const s = toActionState(e);
    if (s?.fieldErrors?.customerId) s.fieldErrors.customerId = "Izberite stranko.";
    if (s?.fieldErrors?.endsAt) s.fieldErrors.end = s.fieldErrors.endsAt;
    return s;
  }
  revalidatePath("/app/reservations");
  redirect(`/app/reservations/${id}?created=1`);
}

export async function transitionAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("reservations.read");
  const to = str(fd, "to");
  if (!(RESERVATION_STATUSES as readonly string[]).includes(to)) return { error: "Neznano dejanje." };
  try {
    await transitionReservation(actor, id, to as ReservationStatus, str(fd, "reason") || undefined);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/app/reservations/${id}`);
  return { ok: true };
}

export async function rescheduleAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("reservations.write");
  const s = localToDate(str(fd, "start"));
  const e = localToDate(str(fd, "end"));
  if (!s || !e) return { error: "Izberite začetek in konec." };
  try {
    await rescheduleReservation(actor, id, s, e);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/reservations/${id}`);
  return { ok: true, message: "Termin je spremenjen, cena je preračunana." };
}

/** Calendar drag & drop: same as reschedule, called with ISO instants from the client. */
export async function moveReservationAction(id: string, startIso: string, endIso: string): Promise<ActionState> {
  const actor = await requireActor("reservations.write");
  try {
    await rescheduleReservation(actor, id, new Date(startIso), new Date(endIso));
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath("/app/calendar");
  return { ok: true };
}

export async function reassignAction(reservationId: string, allocationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("reservations.write");
  try {
    await reassignAllocation(actor, allocationId, str(fd, "unitId"));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/app/reservations/${reservationId}`);
  return { ok: true, message: "Enota je zamenjana." };
}
