'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { geometrySchema } from '@/lib/plots/schemas';
import { createServerSupabase } from '@/lib/supabase/server';
import { DOCUMENT_MIME } from '@/lib/documents/schemas';

export type PortalState = { error?: string; saved?: boolean };

const date = z.preprocess((v) => (v === '' || v == null ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());
const token = z.string().regex(/^[\w-]{32,100}$/);

const plotSchema = z.object({
  token,
  label: z.string().trim().min(1, 'portal.errors.label').max(120, 'portal.errors.label'),
  geometry: z.preprocess((v) => {
    try {
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch {
      return null;
    }
  }, geometrySchema),
  areaHa: z.preprocess((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))), z.number().positive('portal.errors.area').max(100_000).nullable()),
  harvestFrom: date,
  harvestTo: date,
});

const hint = (e: { hint?: string } | null) => (e?.hint === 'LT_LINK_INVALID' ? 'portal.errors.invalid' : e?.hint === 'LT_GEOMETRY' ? 'portal.errors.geometry' : 'portal.errors.unknown');

/** Called from the supplier's browser (no account): the database checks the token and stores the plot for review. */
export async function portalAddPlot(_prev: PortalState, formData: FormData): Promise<PortalState> {
  const parsed = plotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message?.startsWith('portal.') ? parsed.error.issues[0]!.message : 'portal.errors.geometry' };
  const v = parsed.data;
  if (v.harvestFrom && v.harvestTo && v.harvestTo < v.harvestFrom) return { error: 'plots.errors.harvest' };
  const isPoint = v.geometry.type === 'Point' || v.geometry.type === 'MultiPoint';
  if (isPoint && !v.areaHa) return { error: 'portal.errors.area' };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('supplier_portal_add_plot', {
    p_token: v.token,
    p_label: v.label,
    p_geometry: v.geometry as never,
    p_area_ha: isPoint ? v.areaHa : null,
    p_harvest_from: v.harvestFrom,
    p_harvest_to: v.harvestTo,
  });
  if (error) return { error: hint(error) };
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/supply/${v.token}`);
  return { saved: true };
}

const docSchema = z.object({
  token,
  title: z.string().trim().min(1, 'portal.errors.title').max(200, 'portal.errors.title'),
  type: z.enum(['felling_permit', 'decision', 'delivery_note', 'certificate_fsc', 'certificate_pefc', 'other']),
  validFrom: date,
  validTo: date,
  filePath: z.string().min(1).max(500),
  mime: z.enum(DOCUMENT_MIME, { message: 'documents.errors.file' }),
  size: z.coerce.number().int().positive().max(20 * 1024 * 1024),
  plotIds: z.preprocess((v) => (typeof v === 'string' && v ? v.split(',') : []), z.array(z.string().uuid()).max(2000)),
});

export async function portalAddDocument(_prev: PortalState, formData: FormData): Promise<PortalState> {
  const parsed = docSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message?.match(/^(portal|documents)\./) ? parsed.error.issues[0]!.message : 'portal.errors.unknown' };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('supplier_portal_add_document', {
    p_token: v.token,
    p_title: v.title,
    p_type: v.type,
    p_valid_from: v.validFrom,
    p_valid_to: v.validTo,
    p_file_path: v.filePath,
    p_mime: v.mime,
    p_size: v.size,
    p_plot_ids: v.plotIds,
  });
  if (error) return { error: hint(error) };
  revalidatePath(`/${String(formData.get('locale') ?? 'sl')}/supply/${v.token}`);
  return { saved: true };
}
