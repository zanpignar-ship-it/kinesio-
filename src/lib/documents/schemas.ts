import { z } from 'zod';
import { Constants } from '@/lib/db/database.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalDate = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'documents.errors.dates').nullable());

export const documentFormSchema = z
  .object({
    title: z.string().trim().min(1, 'documents.errors.title').max(200, 'documents.errors.title'),
    type: z.enum(Constants.public.Enums.document_type, { message: 'documents.errors.type' }),
    validFrom: optionalDate,
    validTo: optionalDate,
    plotIds: z.preprocess(
      (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter((s) => UUID.test(s)) : Array.isArray(v) ? v : []),
      z.array(z.string()).max(2000),
    ),
  })
  .refine((d) => !d.validFrom || !d.validTo || d.validTo >= d.validFrom, { message: 'documents.errors.dates', path: ['validTo'] });

export type DocumentFormInput = z.infer<typeof documentFormSchema>;

/** File name safe for a storage path. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
  return cleaned.replace(/^[._]+$/, '') || 'file';
}

export const DOCUMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'] as const;
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
