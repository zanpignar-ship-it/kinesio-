'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { deleteDocument } from '@/app/[locale]/app/documents/actions';

export function DocumentDelete({ id }: { id: string }) {
  const t = useTranslations('documents');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(deleteDocument, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t('deleteConfirm'))) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="destructive" disabled={pending} className="self-start">
        {t('delete')}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
    </form>
  );
}
