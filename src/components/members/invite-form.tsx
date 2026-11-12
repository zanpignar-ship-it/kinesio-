'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createInvitation } from '@/app/[locale]/app/settings/member-actions';

export function InviteForm() {
  const t = useTranslations('members');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(createInvitation, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="invite-email">{t('email')}</Label>
          <Input id="invite-email" name="email" type="email" inputMode="email" autoComplete="off" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">{t('role')}</Label>
          <select id="invite-role" name="role" defaultValue="member" className="border-input h-10 rounded-md border bg-transparent px-3 text-sm">
            <option value="member">{t('roles.member')}</option>
            <option value="owner">{t('roles.owner')}</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {t('invite')}
        </Button>
      </form>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      {state.url ? (
        <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
          <p>{t('linkCreated', { email: state.email ?? '' })}</p>
          <code data-testid="invite-url" className="bg-muted break-all rounded p-2">
            {state.url}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              void navigator.clipboard?.writeText(state.url ?? '').then(() => setCopied(true));
            }}
          >
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
