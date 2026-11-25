import { can, type Permission, type Role } from "@/domain/permissions";
import { ForbiddenError } from "../errors";

/** The authenticated member acting inside one organization. */
export type Actor = { orgId: string; userId: string; role: Role };

export function assertCan(actor: Actor, permission: Permission) {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

export const ctx = (a: Actor) => ({ orgId: a.orgId, userId: a.userId });
