'use client';

import { useActionState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { checkTracesStatus, submitToTraces } from '@/app/[locale]/app/shipments/traces-actions';

type Props = {
  shipmentId: string;
  isOwner: boolean;
  configured: { environment: 'acceptance' | 'production' } | null;
  status: string;
  ready: boolean;
  traces: { uuid: string | null; status: string | null; message: string | null; environment: string | null; submittedAt: string | null; checkedAt: string | null };
};

/** Direct submission of the due diligence statement to TRACES and the follow-up for the reference number. */
export function TracesPanel({ shipmentId, isOwner, configured, status, ready, traces }: Props) {
  const t = useTranslations('traces');
  const tAll = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const [submitState, submit, submitting] = useActionState(submitToTraces, {});
  const [checkState, check, checking] = useActionState(checkTracesStatus, {});
  const pending = traces.status === 'SUBMITTED';
  const error = submitState.error ?? checkState.error;
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4" data-testid="traces-panel">
      <h2 className="font-semibold">{t('panelTitle')}</h2>
      {traces.uuid ? (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            {t('stateLabel')}: <strong data-testid="traces-status">{t.has(`states.${traces.status}`) ? t(`states.${traces.status}` as 'states.SUBMITTED') : traces.status}</strong>
            {traces.environment === 'acceptance' ? <span className="text-muted-foreground"> · {t('environments.acceptance')}</span> : null}
          </p>
          <p className="text-muted-foreground text-xs">
            UUID {traces.uuid}
            {traces.submittedAt ? ` · ${t('submittedAt', { date: format.dateTime(new Date(traces.submittedAt), { dateStyle: 'short', timeStyle: 'short' }) })}` : ''}
            {traces.checkedAt ? ` · ${t('checkedAt', { date: format.dateTime(new Date(traces.checkedAt), { dateStyle: 'short', timeStyle: 'short' }) })}` : ''}
          </p>
          {traces.message ? <p className="text-muted-foreground">{traces.message}</p> : null}
          {pending ? <p className="text-muted-foreground text-xs">{t('waitHint')}</p> : null}
        </div>
      ) : traces.message ? (
        <p className="text-destructive text-sm">{traces.message}</p>
      ) : null}

      {!configured ? (
        <p className="text-muted-foreground text-sm">
          {isOwner ? (
            <>
              {t('notConfigured')}{' '}
              <Link href="/app/settings" className="underline underline-offset-4">
                {t('toSettings')}
              </Link>
            </>
          ) : (
            t('ownerOnly')
          )}
        </p>
      ) : !isOwner ? (
        <p className="text-muted-foreground text-sm">{t('ownerOnly')}</p>
      ) : pending ? (
        <form action={check}>
          <input type="hidden" name="id" value={shipmentId} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="outline" disabled={checking}>
            {t('check')}
          </Button>
        </form>
      ) : status === 'ready' && ready && traces.status !== 'AVAILABLE' ? (
        <form action={submit} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={shipmentId} />
          <input type="hidden" name="locale" value={locale} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confidential" className="mt-0.5 size-5" />
            {t('confidential')}
          </label>
          <Button type="submit" className="self-start" disabled={submitting}>
            {configured.environment === 'acceptance' ? t('submitTest') : t('submit')}
          </Button>
        </form>
      ) : status !== 'submitted' ? (
        <p className="text-muted-foreground text-sm">{t('markReadyFirst')}</p>
      ) : null}

      {submitState.result === 'submitted' ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {t('submitted')}
        </p>
      ) : null}
      {checkState.result === 'pending' ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t('stillPending')}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="text-destructive text-sm">
          {tAll(error)}
          {submitState.detail ? <span className="block text-xs">{submitState.detail}</span> : null}
          {submitState.problems?.length ? (
            <ul className="list-disc pl-5 text-xs">
              {submitState.problems.map((p) => (
                <li key={p}>{t(`problems.${p}` as 'problems.noPlots')}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
