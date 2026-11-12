'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { getPlotContext } from '@/lib/plots/context';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME, documentFormSchema } from '@/lib/documents/schemas';

export type DocumentFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};

async function linkPlots(supabase: NonNullable<Awaited<ReturnType<typeof getPlotContext>>>['supabase'], organizationId: string, documentId: string, plotIds: string[]) {
  await supabase.from('plot_documents').delete().eq('organization_id', organizationId).eq('document_id', documentId);
  if (plotIds.length === 0) return null;
  const { error } = await supabase
    .from('plot_documents')
    .insert(plotIds.map((plot_id) => ({ organization_id: organizationId, document_id: documentId, plot_id })));
  return error;
}

/** Called after the browser uploaded the file to documents/<org>/<documentId>/<name>. */
export async function createDocument(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const ctx = await getPlotContext();
  if (!ctx) return { error: 'documents.errors.unknown' };
  const form = documentFormSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: form.error.issues[0]?.message };
  const documentId = str(formData, 'documentId');
  const filePath = str(formData, 'filePath');
  if (!UUID.test(documentId) || !filePath.startsWith(`${ctx.organizationId}/${documentId}/`) || filePath.includes('..')) {
    return { error: 'documents.errors.upload' };
  }
  // Size and type come from the stored object, not from the browser.
  const { data: stored, error: infoError } = await ctx.supabase.storage.from('documents').info(filePath);
  if (infoError || !stored) return { error: 'documents.errors.upload' };
  const mime = (stored.contentType ?? '').split(';')[0]!.trim();
  const size = Number(stored.size);
  if (!(DOCUMENT_MIME as readonly string[]).includes(mime) || !Number.isFinite(size) || size <= 0 || size > DOCUMENT_MAX_BYTES) {
    return { error: 'documents.errors.file' };
  }
  const { error } = await ctx.supabase.from('documents').insert({
    id: documentId,
    organization_id: ctx.organizationId,
    title: form.data.title,
    type: form.data.type,
    valid_from: form.data.validFrom,
    valid_to: form.data.validTo,
    file_path: filePath,
    mime,
    size_bytes: size,
  });
  if (error) return { error: 'documents.errors.unknown' };
  if (await linkPlots(ctx.supabase, ctx.organizationId, documentId, form.data.plotIds)) return { error: 'documents.errors.unknown' };
  revalidatePath(`/${locale}/app/documents`);
  redirect({ href: `/app/documents/${documentId}`, locale });
  return {};
}

export async function updateDocument(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const id = str(formData, 'id');
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return { error: 'documents.errors.unknown' };
  const form = documentFormSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: form.error.issues[0]?.message };
  const { error } = await ctx.supabase
    .from('documents')
    .update({ title: form.data.title, type: form.data.type, valid_from: form.data.validFrom, valid_to: form.data.validTo })
    .eq('organization_id', ctx.organizationId)
    .eq('id', id);
  if (error) return { error: 'documents.errors.unknown' };
  if (await linkPlots(ctx.supabase, ctx.organizationId, id, form.data.plotIds)) return { error: 'documents.errors.unknown' };
  revalidatePath(`/${locale}/app/documents`);
  redirect({ href: `/app/documents/${id}`, locale });
  return {};
}

export async function deleteDocument(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const id = str(formData, 'id');
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return { error: 'documents.errors.unknown' };
  const { data: doc } = await ctx.supabase.from('documents').select('file_path').eq('organization_id', ctx.organizationId).eq('id', id).maybeSingle();
  if (!doc) return { error: 'documents.errors.notFound' };
  const { error } = await ctx.supabase.from('documents').delete().eq('organization_id', ctx.organizationId).eq('id', id);
  // A document used in a shipment fails the (deferred) foreign key at commit.
  if (error) return { error: error.code === '23503' ? 'documents.errors.inUse' : 'documents.errors.unknown' };
  await ctx.supabase.storage.from('documents').remove([doc.file_path]);
  revalidatePath(`/${locale}/app/documents`);
  redirect({ href: '/app/documents', locale });
  return {};
}
