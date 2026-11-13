'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { createSupplierLink } from '@/app/[locale]/app/master-data/supplier-link-actions';

export function SupplierLinkForm({ supplierId }: { supplierId: string }) {
  const t = useTranslations('portal');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(createSupplierLink, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="supplierId" value={supplierId} />
        <label className="flex flex-col gap-1 text-sm">
          {t('validFor')}
          <select name="days" defaultValue="90" className="border-input h-10 rounded-md border bg-card px-3 text-sm">
            {[30, 90, 365].map((d) => (
              <option key={d} value={d}>
                {t('days', { days: d })}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {t('createLink')}
        </Button>
      </form>
      {state.url ? (
        <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
          <p>{t('linkCreated')}</p>
          <code data-testid="supplier-link-url" className="bg-muted break-all rounded p-2">
            {state.url}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void navigator.clipboard?.writeText(state.url ?? '').then(() => setCopied(true))}
          >
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
    </div>
  );
}
