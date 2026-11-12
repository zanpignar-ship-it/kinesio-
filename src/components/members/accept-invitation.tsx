'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { acceptInvitation } from '@/app/[locale]/invite/[token]/actions';

export function AcceptInvitation({ token }: { token: string }) {
  const t = useTranslations('members');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(acceptInvitation, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {t('accept')}
      </Button>
    </form>
  );
}
