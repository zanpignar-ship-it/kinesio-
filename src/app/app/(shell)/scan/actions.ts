"use server";

import { redirect } from "next/navigation";
import { requireActor } from "@/server/session";
import { withTenant } from "@/server/db";
import { str, type ActionState } from "@/server/action";

/** Resolves a scanned QR payload (passport URL or token) or a typed inventory/serial number within the active organization. */
export async function lookupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("inventory.read");
  const raw = str(fd, "code").slice(0, 300);
  if (!raw) return { error: "Vnesite inventarno številko ali skenirajte QR kodo." };
  const token = /\/p\/([a-f0-9]{24})/.exec(raw)?.[1] ?? (/^[a-f0-9]{24}$/.test(raw) ? raw : null);
  const unit = await withTenant({ orgId: actor.orgId, userId: actor.userId }, (tx) =>
    tx.maybeOne<{ id: string }>(
      `select id from units where org_id = $1 and (qr_token = $2 or upper(internal_code) = upper($3) or upper(serial_number) = upper($3)) limit 1`,
      [actor.orgId, token, raw],
    ));
  if (!unit) return { error: token ? "QR koda ne pripada opremi vaše izposojevalnice." : `Enote »${raw}« ni bilo mogoče najti.` };
  redirect(`/app/units/${unit.id}?scan=1`);
}
