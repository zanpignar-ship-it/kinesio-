'use client';

import { useActionState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CopyButton } from '@/components/shipments/copy-button';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createShare, revokeShare } from '@/app/[locale]/app/shipments/share-actions';

type Share = { id: string; expires_at: string; revoked_at: string | null; last_viewed_at: string | null };

export function SharePanel({ shipmentId, shares }: { shipmentId: string; shares: Share[] }) {
  const t = useTranslations('share');
  const tAll = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const [state, action, pending] = useActionState(createShare, {});
  const when = (d: string) => format.dateTime(new Date(d), { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t('title')}</h2>
      <Button asChild variant="outline" className="self-start">
        <a href={`/${locale}/app/shipments/${shipmentId}/pdf`}>{t('downloadPdf')}</a>
      </Button>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="days">{t('expiresIn')}</Label>
          <select id="days" name="days" defaultValue="30" className="border-input h-10 rounded-md border bg-transparent px-3 text-base md:text-sm">
            {[7, 30, 90, 365].map((d) => (
              <option key={d} value={d}>
                {t('daysOption', { days: d })}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="includeDocuments" defaultChecked className="size-5" />
          {t('includeDocuments')}
        </label>
        <Button type="submit" disabled={pending}>
          {t('createLink')}
        </Button>
      </form>
      {state.url ? (
        <div className="flex flex-col gap-2 rounded-md bg-emerald-50 p-3 text-sm dark:bg-emerald-950/40">
          <p>{t('linkCreated')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code data-testid="share-url" className="break-all">
              {state.url}
            </code>
            <CopyButton value={state.url} />
          </div>
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      {shares.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('activeLinks')}</h3>
          <ul className="divide-y rounded-md border text-sm">
            {shares.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="flex-1">{s.revoked_at ? t('revoked') : t('expires', { date: when(s.expires_at) })}</span>
                <span className="text-muted-foreground">{s.last_viewed_at ? t('lastViewed', { date: when(s.last_viewed_at) }) : t('neverViewed')}</span>
                {!s.revoked_at ? (
                  <form action={revokeShare}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="shipmentId" value={shipmentId} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t('revoke')}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
