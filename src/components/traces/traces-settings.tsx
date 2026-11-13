'use client';

import { useActionState, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteTracesCredentials, saveTracesCredentials, testTracesConnection, type TracesFormState } from '@/app/[locale]/app/settings/traces-actions';

type Props = { settings: { environment: 'acceptance' | 'production'; username: string; clientId: string } | null; defaults: { acceptance: string; production: string } };

const field = 'border-input h-10 w-full rounded-md border bg-card px-3 text-base md:text-sm';

/** TRACES web-service user of the organization (owners only). The key is write-only. */
export function TracesSettings({ settings, defaults }: Props) {
  const t = useTranslations('traces');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveTracesCredentials, {});
  const [env, setEnv] = useState<'acceptance' | 'production'>(settings?.environment ?? 'acceptance');
  const [clientId, setClientId] = useState(settings?.clientId ?? defaults.acceptance);
  const [test, setTest] = useState<TracesFormState | null>(null);
  const [testing, startTest] = useTransition();
  return (
    <div className="flex flex-col gap-4" data-testid="traces-settings">
      <p className="text-muted-foreground text-sm">{t('settingsIntro')}</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="traces-env">{t('environment')}</Label>
          <select
            id="traces-env"
            name="environment"
            className={field}
            value={env}
            onChange={(e) => {
              const next = e.target.value as 'acceptance' | 'production';
              if (clientId === defaults[env]) setClientId(defaults[next]);
              setEnv(next);
            }}
          >
            <option value="acceptance">{t('environments.acceptance')}</option>
            <option value="production">{t('environments.production')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="traces-username">{t('username')}</Label>
          <Input id="traces-username" name="username" autoComplete="off" defaultValue={settings?.username ?? ''} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="traces-key">{t('authKey')}</Label>
          <Input id="traces-key" name="authKey" type="password" autoComplete="new-password" placeholder={settings ? t('authKeyKeep') : ''} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="traces-client">{t('clientId')}</Label>
          <Input id="traces-client" name="clientId" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <p className="text-muted-foreground text-xs">{t('clientIdHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {t('save')}
          </Button>
          {settings ? (
            <Button type="button" variant="outline" disabled={testing} onClick={() => startTest(async () => setTest(await testTracesConnection()))}>
              {t('test')}
            </Button>
          ) : null}
        </div>
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
        {test ? (
          <p role="status" data-testid="traces-test" className={test.ok ? 'text-sm text-green-700 dark:text-green-400' : 'text-destructive text-sm'}>
            {test.error ? tAll(test.error) : test.ok ? t('testOk', { detail: test.detail ?? '' }) : t('testFailed', { detail: test.detail ?? '' })}
          </p>
        ) : null}
      </form>
      {settings ? (
        <form action={deleteTracesCredentials}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            {t('remove')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
