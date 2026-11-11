'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { copyShipment, setShipmentStatus } from '@/app/[locale]/app/shipments/actions';

type Props = { id: string; status: 'draft' | 'ready' | 'submitted' | 'rejected'; ready: boolean; ddsReference: string | null; ddsVerification: string | null };

export function StatusActions({ id, status, ready, ddsReference, ddsVerification }: Props) {
  const t = useTranslations('ship');
  const tAll = useTranslations();
  const locale = useLocale();
  const [s1, setStatus, p1] = useActionState(setShipmentStatus, {});
  const [s2, copy, p2] = useActionState(copyShipment, {});
  const error = s1.error ?? s2.error;
  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      {status === 'draft' || status === 'rejected' ? (
        <form action={setStatus}>
          {hidden}
          <input type="hidden" name="status" value="ready" />
          <Button type="submit" disabled={!ready || p1}>
            {t('markReady')}
          </Button>
        </form>
      ) : null}
      {status !== 'submitted' ? (
        <form action={setStatus} className="flex flex-col gap-3 rounded-xl border p-4">
          {hidden}
          <input type="hidden" name="status" value="submitted" />
          <h3 className="font-semibold">{t('submitTitle')}</h3>
          <p className="text-muted-foreground text-sm">{t('submitHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ddsReference">{t('ddsReference')}</Label>
              <Input id="ddsReference" name="ddsReference" defaultValue={ddsReference ?? ''} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ddsVerification">{t('ddsVerification')}</Label>
              <Input id="ddsVerification" name="ddsVerification" defaultValue={ddsVerification ?? ''} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={p1}>
              {t('markSubmitted')}
            </Button>
          </div>
        </form>
      ) : null}
      {status === 'submitted' ? (
        <form action={setStatus}>
          {hidden}
          <input type="hidden" name="status" value="rejected" />
          <Button type="submit" variant="outline" disabled={p1}>
            {t('markRejected')}
          </Button>
        </form>
      ) : null}
      <form action={copy}>
        {hidden}
        <Button type="submit" variant="outline" disabled={p2}>
          {t('copyShipment')}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(error)}
        </p>
      ) : null}
    </div>
  );
}
