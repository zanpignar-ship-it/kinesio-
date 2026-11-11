'use client';

import { startTransition, useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDocument, updateDocument } from '@/app/[locale]/app/documents/actions';
import { Constants } from '@/lib/db/database.types';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME, safeFileName } from '@/lib/documents/schemas';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { PlotPicker } from './plot-picker';

type Initial = { id?: string; title?: string; type?: string; validFrom?: string | null; validTo?: string | null; plotIds?: string[] };
type Props = { organizationId: string; plots: { id: string; label: string }[]; initial?: Initial };

const selectClass = 'border-input h-10 w-full rounded-md border bg-transparent px-3 text-base shadow-xs md:text-sm';

export function DocumentForm({ organizationId, plots, initial = {} }: Props) {
  const t = useTranslations('documents');
  const tAll = useTranslations();
  const locale = useLocale();
  const editing = Boolean(initial.id);
  const [state, action, pending] = useActionState(editing ? updateDocument : createDocument, {});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadError(null);
    const formData = new FormData(e.currentTarget);
    if (!editing) {
      const file = formData.get('file');
      if (!(file instanceof File) || file.size === 0 || file.size > DOCUMENT_MAX_BYTES || !(DOCUMENT_MIME as readonly string[]).includes(file.type)) {
        setUploadError('documents.errors.file');
        return;
      }
      const documentId = crypto.randomUUID();
      const filePath = `${organizationId}/${documentId}/${safeFileName(file.name)}`;
      setUploading(true);
      const { error } = await createBrowserSupabase().storage.from('documents').upload(filePath, file, { contentType: file.type, upsert: false });
      setUploading(false);
      if (error) {
        setUploadError('documents.errors.upload');
        return;
      }
      formData.delete('file');
      formData.set('documentId', documentId);
      formData.set('filePath', filePath);
      formData.set('mime', file.type);
      formData.set('size', String(file.size));
    }
    startTransition(() => action(formData));
  };

  const error = uploadError ?? state.error;
  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {!editing ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="file">{t('file')}</Label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
            className="file:bg-primary file:text-primary-foreground text-sm file:mr-3 file:h-11 file:rounded-md file:border-0 file:px-4"
          />
          <p className="text-muted-foreground text-xs">{t('fileHint')}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t('docTitle')}</Label>
        <Input id="title" name="title" required defaultValue={initial.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">{t('type')}</Label>
        <select id="type" name="type" className={selectClass} defaultValue={initial.type ?? 'felling_permit'}>
          {Constants.public.Enums.document_type.map((ty) => (
            <option key={ty} value={ty}>
              {t(`types.${ty}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="validFrom">{t('validFrom')}</Label>
          <Input id="validFrom" name="validFrom" type="date" defaultValue={initial.validFrom ?? ''} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="validTo">{t('validTo')}</Label>
          <Input id="validTo" name="validTo" type="date" defaultValue={initial.validTo ?? ''} />
        </div>
      </div>
      <PlotPicker plots={plots} initial={initial.plotIds ?? []} />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12" disabled={pending || uploading}>
        {uploading ? t('uploading') : t('save')}
      </Button>
    </form>
  );
}
