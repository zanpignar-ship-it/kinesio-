"use server";

import { redirect } from "next/navigation";
import { createOrganization } from "@/server/services/organizations";
import { getSession, sessionToken } from "@/server/session";
import { setActiveOrg } from "@/server/services/identity";
import { str, toActionState, type ActionState } from "@/server/action";

export async function createOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await getSession();
  const token = await sessionToken();
  if (!s || !token) redirect("/login");
  try {
    const org = await createOrganization(s.user.id, {
      name: str(fd, "name"),
      legalName: str(fd, "legalName"),
      taxId: str(fd, "taxId"),
      city: str(fd, "city"),
      address: str(fd, "address"),
      phone: str(fd, "phone"),
      planCode: (str(fd, "plan") || "pro") as "basic" | "pro" | "enterprise",
    });
    await setActiveOrg(token, org.id, s.user.id);
  } catch (e) {
    return toActionState(e);
  }
  redirect("/app?welcome=1");
}
