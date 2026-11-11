'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormState } from '@/app/[locale]/(auth)/actions';

type Props = {
  mode: 'signIn' | 'signUp';
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  next?: string;
};

export function AuthForm({ mode, action, next }: Props) {
  const t = useTranslations('auth');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state.fields?.email} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'signUp' ? 8 : undefined}
        />
        {mode === 'signUp' ? <p className="text-muted-foreground text-sm">{t('passwordHint')}</p> : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {mode === 'signIn' ? t('signIn') : t('signUp')}
      </Button>
    </form>
  );
}
