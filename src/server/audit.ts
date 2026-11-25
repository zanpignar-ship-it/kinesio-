import type { Tx } from "./db";

export async function audit(
  tx: Tx,
  e: { orgId: string | null; actorUserId?: string | null; action: string; entityType: string; entityId?: string | null; data?: Record<string, unknown> },
) {
  await tx.query(
    "insert into audit_logs (org_id, actor_user_id, action, entity_type, entity_id, data) values ($1,$2,$3,$4,$5,$6)",
    [e.orgId, e.actorUserId ?? null, e.action, e.entityType, e.entityId ?? null, JSON.stringify(e.data ?? {})],
  );
}
