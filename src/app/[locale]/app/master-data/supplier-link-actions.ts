'use server';

import { revalidatePath } from 'next/cache';
import { requestOrigin } from '@/lib/http/origin';
import { getPlotContext } from '@/lib/plots/context';
import { createShareToken } from '@/lib/share/token';

export type SupplierLinkState = { error?: string; url?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAYS = [30, 90, 365];

/** A link the supplier opens without an account; the token is shown once, only its hash is stored. */
export async function createSupplierLink(_prev: SupplierLinkState, formData: FormData): Promise<SupplierLinkState> {
  const locale = String(formData.get('locale') ?? 'sl');
  const supplierId = String(formData.get('supplierId') ?? '');
  const days = Number(formData.get('days'));
  const ctx = await getPlotContext();
  const origin = await requestOrigin();
  if (!ctx || !origin || !UUID.test(supplierId) || !DAYS.includes(days)) return { error: 'portal.errors.unknown' };
  const { token, hashHex } = createShareToken();
  const { error } = await ctx.supabase.from('supplier_links').insert({
    organization_id: ctx.organizationId,
    supplier_id: supplierId,
    token_hash: `\\x${hashHex}`,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  if (error) return { error: 'portal.errors.unknown' };
  revalidatePath(`/${locale}/app/master-data/suppliers/${supplierId}`);
  return { url: `${origin}/${locale}/supply/${token}` };
}

export async function revokeSupplierLink(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const supplierId = String(formData.get('supplierId') ?? '');
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return;
  await ctx.supabase.from('supplier_links').update({ revoked_at: new Date().toISOString() }).eq('organization_id', ctx.organizationId).eq('id', id);
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/app/master-data/suppliers/${supplierId}`);
}
