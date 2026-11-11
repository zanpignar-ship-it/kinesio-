'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { archivePlot, deletePlot } from '@/app/[locale]/app/plots/actions';

export function PlotActions({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations('plots');
  const tAll = useTranslations();
  const locale = useLocale();
  const [archiveState, archive, archiving] = useActionState(archivePlot, {});
  const [deleteState, remove, deleting] = useActionState(deletePlot, {});
  const error = archiveState.error ?? deleteState.error;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={archive}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="locale" value={locale} />
          {archived ? <input type="hidden" name="restore" value="1" /> : null}
          <Button type="submit" variant="outline" disabled={archiving}>
            {archived ? t('restore') : t('archive')}
          </Button>
        </form>
        <form
          action={remove}
          onSubmit={(e) => {
            if (!window.confirm(t('deleteConfirm'))) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="destructive" disabled={deleting}>
            {t('delete')}
          </Button>
        </form>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(error)}
        </p>
      ) : null}
    </div>
  );
}
