'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { repairPlot } from '@/app/[locale]/app/plots/actions';

/** Offered when the outline crosses itself: split it into simple polygons, then the user checks the map. */
export function RepairButton({ id }: { id: string }) {
  const t = useTranslations('plots');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(repairPlot, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <p>{t('repairHint')}</p>
      <Button type="submit" variant="outline" size="sm" className="self-start" disabled={pending}>
        {t('repair')}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive">
          {tAll(state.error)}
        </p>
      ) : null}
    </form>
  );
}
