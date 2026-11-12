'use server';

import { revalidatePath } from 'next/cache';
import { requestOrigin } from '@/lib/http/origin';
import { getPlotContext } from '@/lib/plots/context';
import { createShareToken } from '@/lib/share/token';

export type ShareState = { error?: string; url?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DAYS = [7, 30, 90, 365];

/** Create a buyer link for one shipment; the token is shown once and only its hash is stored. */
export async function createShare(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const shipmentId = String(formData.get('shipmentId') ?? '');
  const locale = String(formData.get('locale') ?? 'sl');
  const days = Number(formData.get('days'));
  const origin = await requestOrigin();
  const ctx = await getPlotContext();
  if (!ctx || !origin || !UUID.test(shipmentId) || !ALLOWED_DAYS.includes(days)) return { error: 'share.errors.unknown' };
  const { token, hashHex } = createShareToken();
  const { error } = await ctx.supabase.from('buyer_shares').insert({
    organization_id: ctx.organizationId,
    token_hash: `\\x${hashHex}`,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
    shipment_ids: [shipmentId],
    include_documents: formData.get('includeDocuments') === 'on',
  });
  if (error) return { error: 'share.errors.unknown' };
  revalidatePath(`/${locale}/app/shipments/${shipmentId}`);
  return { url: `${origin}/${locale}/share/${token}` };
}

export async function revokeShare(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const shipmentId = String(formData.get('shipmentId') ?? '');
  const locale = String(formData.get('locale') ?? 'sl');
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return;
  await ctx.supabase.from('buyer_shares').update({ revoked_at: new Date().toISOString() }).eq('organization_id', ctx.organizationId).eq('id', id);
  revalidatePath(`/${locale}/app/shipments/${shipmentId}`);
}
