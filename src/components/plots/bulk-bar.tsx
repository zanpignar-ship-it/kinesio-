'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { bulkUpdatePlots } from '@/app/[locale]/app/plots/actions';

const field = 'border-input h-10 w-full rounded-md border bg-card px-3 text-sm';

/** Applies to the plots whose checkboxes (form="bulk-form") are ticked in the list. */
export function BulkBar({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const t = useTranslations('plots');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(bulkUpdatePlots, {});
  return (
    <form id="bulk-form" action={action} className="flex flex-col gap-3 rounded-xl border p-4" data-testid="bulk-bar">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm font-medium">{t('bulkTitle')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="bulk-supplier" className="text-xs">{t('supplier')}</Label>
          <select id="bulk-supplier" name="supplier" defaultValue="" className={field}>
            <option value="">{t('bulkKeep')}</option>
            <option value="none">{t('noSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bulk-from" className="text-xs">{t('harvest')} – {t('harvestFrom')}</Label>
          <input id="bulk-from" name="harvestFrom" type="date" className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bulk-to" className="text-xs">{t('harvest')} – {t('harvestTo')}</Label>
          <input id="bulk-to" name="harvestTo" type="date" className={field} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="action" value="update" disabled={pending}>
          {t('bulkApply')}
        </Button>
        <Button type="submit" name="action" value="archive" variant="outline" disabled={pending}>
          {t('bulkArchive')}
        </Button>
      </div>
      {state.updated !== undefined ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {t('bulkDone', { count: state.updated })}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
    </form>
  );
}
