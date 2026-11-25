"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/session";
import { updateOrganization } from "@/server/services/organizations";
import { addMemberByEmail, changeMemberRole } from "@/server/services/members";
import { bool, str, toActionState, type ActionState } from "@/server/action";
import type { Role } from "@/domain/permissions";

export async function updateOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("org.manage");
  try {
    await updateOrganization(actor, {
      name: str(fd, "name"), legalName: str(fd, "legalName"), taxId: str(fd, "taxId"), registrationNo: str(fd, "registrationNo"),
      phone: str(fd, "phone"), email: str(fd, "email"), vatPayer: bool(fd, "vatPayer"),
    });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/app", "layout");
  return { ok: true, message: "Podatki podjetja so shranjeni." };
}

export async function changeRoleAction(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("members.manage");
  try {
    await changeMemberRole(actor, userId, str(fd, "role") as Role);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/app/settings");
  return { ok: true, message: "Vloga je spremenjena." };
}

export async function addMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("members.manage");
  try {
    await addMemberByEmail(actor, str(fd, "email"), str(fd, "role") as Role);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/app/settings");
  return { ok: true, message: "Sodelavec je dodan. Ob naslednji prijavi bo videl vašo izposojevalnico." };
}
