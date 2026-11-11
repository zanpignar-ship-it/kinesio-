'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAccount } from '@/app/[locale]/app/settings/actions';

export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations('settings');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <Label htmlFor="confirm">{t('deleteConfirmLabel', { email })}</Label>
      <Input id="confirm" name="confirm" autoComplete="off" />
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
          {state.blocked?.length ? ` ${state.blocked.join(', ')}` : null}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" disabled={pending} className="self-start">
        {t('deleteButton')}
      </Button>
    </form>
  );
}
