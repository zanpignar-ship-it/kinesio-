'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { portalAddDocument } from '@/app/[locale]/supply/[token]/actions';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME, safeFileName } from '@/lib/documents/schemas';
import { createBrowserSupabase } from '@/lib/supabase/browser';

type Props = { token: string; organizationId: string; linkId: string; plots: { id: string; label: string }[] };

const field = 'border-input h-10 w-full rounded-md border bg-card px-3 text-base md:text-sm';

/** Upload a permit or certificate: the file goes to the link's own folder, then the database records it. */
export function PortalDocumentForm({ token, organizationId, linkId, plots }: Props) {
  const t = useTranslations('portal');
  const tdoc = useTranslations('documents');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(portalAddDocument, {});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const submit = (fd: FormData) =>
    startUpload(async () => {
      setUploadError(null);
      const file = fd.get('file');
      if (!(file instanceof File) || file.size === 0 || file.size > DOCUMENT_MAX_BYTES || !(DOCUMENT_MIME as readonly string[]).includes(file.type)) {
        setUploadError('documents.errors.file');
        return;
      }
      const path = `${organizationId}/portal-${linkId}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
      const { error } = await createBrowserSupabase().storage.from('documents').upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setUploadError('documents.errors.upload');
        return;
      }
      fd.delete('file');
      fd.set('filePath', path);
      fd.set('mime', file.type);
      fd.set('size', String(file.size));
      fd.set('plotIds', selected.join(','));
      action(fd);
      form.current?.reset();
      setSelected([]);
    });

  return (
    <form ref={form} action={submit} className="flex flex-col gap-3" data-testid="portal-document-form">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="portal-file">{tdoc('file')}</Label>
        <input id="portal-file" name="file" type="file" accept={DOCUMENT_MIME.join(',')} capture="environment" className="text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-title">{tdoc('docTitle')}</Label>
          <Input id="portal-title" name="title" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-type">{tdoc('type')}</Label>
          <select id="portal-type" name="type" defaultValue="felling_permit" className={field}>
            {(['felling_permit', 'decision', 'delivery_note', 'certificate_fsc', 'certificate_pefc', 'other'] as const).map((k) => (
              <option key={k} value={k}>
                {tdoc(`types.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-from">{tdoc('validFrom')}</Label>
          <Input id="portal-from" name="validFrom" type="date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-to">{tdoc('validTo')}</Label>
          <Input id="portal-to" name="validTo" type="date" />
        </div>
      </div>
      {plots.length ? (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t('documentPlots')}</legend>
          {plots.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={selected.includes(p.id)}
                onChange={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
              />
              {p.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      <Button type="submit" className="self-start" disabled={pending || uploading}>
        {t('upload')}
      </Button>
      {state.saved && !uploadError ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {t('documentSaved')}
        </p>
      ) : null}
      {uploadError || state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(uploadError ?? state.error!)}
        </p>
      ) : null}
    </form>
  );
}
