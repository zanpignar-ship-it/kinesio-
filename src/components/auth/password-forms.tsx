'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset, updatePassword } from '@/app/[locale]/(auth)/password-actions';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  if (state.sent) {
    return (
      <p role="status" className="rounded-md border p-4 text-sm">
        {t('resetSent')}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {t('sendReset')}
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const t = useTranslations('auth');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('newPassword')}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <p className="text-muted-foreground text-sm">{t('passwordHint')}</p>
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {t('savePassword')}
      </Button>
    </form>
  );
}
