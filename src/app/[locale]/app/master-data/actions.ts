'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { isEntity, SCHEMAS, toColumns } from '@/lib/masterdata/config';
import { getPlotContext } from '@/lib/plots/context';
import { recordKey } from '@/lib/masterdata/import';

export type RecordFormState = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};

export async function saveRecord(_prev: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const entity = str(formData, 'entity');
  const id = str(formData, 'id');
  const locale = str(formData, 'locale') || 'sl';
  const ctx = await getPlotContext();
  if (!ctx || !isEntity(entity)) return { error: 'md.errors.unknown' };
  const parsed = SCHEMAS[entity].safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'md.errors.unknown' };
  const columns = toColumns(entity, parsed.data as Record<string, unknown>);
  const table = ctx.supabase.from(entity);
  const { error } = id
    ? UUID.test(id)
      ? await table.update(columns as never).eq('organization_id', ctx.organizationId).eq('id', id)
      : { error: new Error('bad id') }
    : await table.insert({ ...columns, organization_id: ctx.organizationId } as never);
  if (error) return { error: 'md.errors.unknown' };
  revalidatePath(`/${locale}/app/master-data/${entity}`);
  redirect({ href: `/app/master-data/${entity}`, locale });
  return {};
}

export async function deleteRecord(_prev: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const entity = str(formData, 'entity');
  const id = str(formData, 'id');
  const locale = str(formData, 'locale') || 'sl';
  const ctx = await getPlotContext();
  if (!ctx || !isEntity(entity) || !UUID.test(id)) return { error: 'md.errors.unknown' };
  const { error } = await ctx.supabase.from(entity).delete().eq('organization_id', ctx.organizationId).eq('id', id);
  if (error) return { error: error.code === '23503' ? 'md.errors.inUse' : 'md.errors.unknown' };
  revalidatePath(`/${locale}/app/master-data/${entity}`);
  redirect({ href: `/app/master-data/${entity}`, locale });
  return {};
}

export type ImportRecordsResult = { error?: string; inserted?: number; skipped?: number };

/** Insert customers or suppliers parsed from a spreadsheet; rows with an existing name + country are skipped. */
export async function importRecords(entity: string, records: Record<string, string>[], locale: string): Promise<ImportRecordsResult> {
  const ctx = await getPlotContext();
  if (!ctx || (entity !== 'customers' && entity !== 'suppliers')) return { error: 'md.errors.unknown' };
  if (!Array.isArray(records) || records.length === 0) return { error: 'md.import.empty' };
  if (records.length > 5000) return { error: 'md.import.tooMany' };
  const valid: Record<string, unknown>[] = [];
  for (const r of records) {
    const parsed = SCHEMAS[entity].safeParse(r);
    if (parsed.success) valid.push(toColumns(entity, parsed.data as Record<string, unknown>));
  }
  // Existing records (paged past the 1000-row API limit).
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await ctx.supabase.from(entity).select('id, name, country').eq('organization_id', ctx.organizationId).order('id').range(from, from + 999);
    for (const d of data ?? []) existing.add(recordKey({ name: d.name, country: d.country }));
    if (!data || data.length < 1000) break;
  }
  const fresh: Record<string, unknown>[] = [];
  for (const v of valid) {
    const key = recordKey({ name: String(v.name), country: String(v.country) });
    if (existing.has(key)) continue;
    existing.add(key);
    fresh.push({ ...v, organization_id: ctx.organizationId });
  }
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await ctx.supabase.from(entity).insert(fresh.slice(i, i + 500) as never);
    if (error) return { error: 'md.errors.unknown', inserted: i };
  }
  revalidatePath(`/${locale}/app/master-data/${entity}`);
  return { inserted: fresh.length, skipped: records.length - fresh.length };
}
