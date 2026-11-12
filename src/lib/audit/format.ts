type Json = Record<string, unknown> | null;

const NAME_FIELDS = ['label', 'internal_ref', 'title', 'name', 'reference_no', 'email'] as const;
const IGNORED = new Set(['updated_at', 'created_at', 'validation_issues', 'geom', 'geom_snapshot']);

/** A readable name for the changed row (plot label, shipment reference, document title …). */
export function auditSubject(oldData: Json, newData: Json): string {
  const row = newData ?? oldData ?? {};
  for (const f of NAME_FIELDS) {
    const v = row[f];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/** Columns whose value changed in an UPDATE (technical columns left out; geometry reported once). */
export function changedFields(oldData: Json, newData: Json): string[] {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const out: string[] = [];
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) out.push(k);
  }
  if (JSON.stringify(oldData.geom) !== JSON.stringify(newData.geom) && ('geom' in oldData || 'geom' in newData)) out.push('geom');
  return out.sort();
}
