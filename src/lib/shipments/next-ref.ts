/**
 * Internal reference for a copied shipment: "S-12" → "S-12-2", "S-12-2" → "S-12-3", skipping existing references.
 * A trailing "-N" (N < 100) counts as a copy number only when the rest still contains a dash ("S-12-2", not "S-12").
 */
export function nextCopyRef(ref: string, existing: string[]): string {
  const m = /^(.*-.*)-(\d{1,2})$/.exec(ref);
  const stem = m ? m[1]! : ref;
  let n = m ? Number(m[2]) + 1 : 2;
  const taken = new Set(existing);
  while (taken.has(`${stem}-${n}`)) n += 1;
  return `${stem}-${n}`;
}
