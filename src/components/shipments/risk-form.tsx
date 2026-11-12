'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { saveRiskAssessment } from '@/app/[locale]/app/shipments/actions';
import type { RiskLevel } from '@/lib/shipments/risk';
import { cn } from '@/lib/utils';

type Props = {
  shipmentId: string;
  level: RiskLevel | null;
  country: string | null;
  assessment: string | null;
  mitigation: string | null;
  negligible: boolean | null;
  locked: boolean;
};

const BADGE: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  standard: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  high: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
};

const textareaClass = 'border-input min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs md:text-sm';

/** Country risk of the shipment and the recorded risk assessment (EUDR art. 10, 11, 13). */
export function RiskForm({ shipmentId, level, country, assessment, mitigation, negligible, locked }: Props) {
  const t = useTranslations('risk');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveRiskAssessment, {});
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4" data-testid="risk">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{t('title')}</h2>
        {level ? (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', BADGE[level])} data-testid="risk-level">
            {t(`levels.${level}`, { country: country ?? '' })}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">{level === 'low' ? t('lowHint') : level ? t('assessHint') : t('noCountry')}</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={shipmentId} />
        <input type="hidden" name="locale" value={locale} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="riskAssessment">{t('assessment')}</Label>
            <textarea id="riskAssessment" name="riskAssessment" className={textareaClass} defaultValue={assessment ?? ''} maxLength={5000} placeholder={t('assessmentPlaceholder')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="riskMitigation">{t('mitigation')}</Label>
            <textarea id="riskMitigation" name="riskMitigation" className={textareaClass} defaultValue={mitigation ?? ''} maxLength={5000} placeholder={t('mitigationPlaceholder')} />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="riskNegligible" defaultChecked={negligible === true} className="mt-0.5 size-5" />
            {t('negligible')}
          </label>
          {locked ? null : (
            <Button type="submit" variant="outline" className="self-start" disabled={pending}>
              {t('save')}
            </Button>
          )}
        </fieldset>
        {state.saved ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {t('saved')}
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {tAll(state.error)}
          </p>
        ) : null}
      </form>
    </section>
  );
}
