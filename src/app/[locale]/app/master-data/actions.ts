'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { isEntity, SCHEMAS, toColumns } from '@/lib/masterdata/config';
import { getPlotContext } from '@/lib/plots/context';

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
