"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/session";
import { changeUnitStatus } from "@/server/services/inventory";
import { createBlock, removeBlock } from "@/server/services/reservations";
import { str, toActionState, type ActionState } from "@/server/action";
import { UNIT_STATUSES, type UnitStatus } from "@/domain/unit";
import { localToDate } from "@/lib/datetime";

export async function changeStatusAction(unitId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("units.status");
  const to = str(fd, "to");
  if (!(UNIT_STATUSES as readonly string[]).includes(to)) return { error: "Izberite novo stanje." };
  try {
    await changeUnitStatus(actor, unitId, to as UnitStatus, str(fd, "reason") || undefined);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/app/units/${unitId}`);
  return { ok: true, message: "Stanje enote je posodobljeno." };
}

export async function createBlockAction(unitId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const startsAt = localToDate(str(fd, "start"));
  const endsAt = localToDate(str(fd, "end"));
  if (!startsAt || !endsAt) return { error: "Vnesite začetek in konec.", fieldErrors: { ...(!startsAt && { start: "Obvezno." }), ...(!endsAt && { end: "Obvezno." }) } };
  try {
    await createBlock(actor, { unitId, kind: str(fd, "kind") === "block" ? "block" : "maintenance", startsAt, endsAt, note: str(fd, "note") || null });
  } catch (e) {
    const s = toActionState(e);
    if (s?.fieldErrors?.endsAt) s.fieldErrors.end = s.fieldErrors.endsAt;
    return s;
  }
  revalidatePath(`/app/units/${unitId}`);
  return { ok: true, message: "Termin je blokiran v koledarju." };
}

export async function removeBlockAction(unitId: string, allocationId: string) {
  const actor = await requireActor("inventory.write");
  await removeBlock(actor, allocationId);
  revalidatePath(`/app/units/${unitId}`);
}
