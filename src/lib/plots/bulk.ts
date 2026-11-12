import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const date = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);

/** Changes applied to many plots at once; empty fields mean "leave as is". */
export const bulkSchema = z
  .object({
    ids: z.array(uuid).min(1, 'plots.errors.noneSelected').max(500),
    action: z.enum(['update', 'archive']),
    supplier: z.union([z.literal(''), z.literal('none'), uuid]),
    harvestFrom: date,
    harvestTo: date,
  })
  .refine((v) => !v.harvestFrom || !v.harvestTo || v.harvestTo >= v.harvestFrom, { message: 'plots.errors.harvest' });

export type BulkInput = z.infer<typeof bulkSchema>;

/** Columns to update, or null when nothing would change. */
export type BulkChanges = { supplier_id?: string | null; harvest_from?: string; harvest_to?: string; archived_at?: string };

export function bulkChanges(v: BulkInput): BulkChanges | null {
  const out: BulkChanges = {};
  if (v.action === 'archive') return { archived_at: new Date().toISOString() };
  if (v.supplier === 'none') out.supplier_id = null;
  else if (v.supplier) out.supplier_id = v.supplier;
  if (v.harvestFrom) out.harvest_from = v.harvestFrom;
  if (v.harvestTo) out.harvest_to = v.harvestTo;
  return Object.keys(out).length ? out : null;
}
