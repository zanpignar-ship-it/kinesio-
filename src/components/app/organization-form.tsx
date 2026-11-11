'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOrganization } from '@/app/[locale]/onboarding/actions';
import { ORG_COUNTRIES } from '@/lib/auth/schemas';
import { Constants } from '@/lib/db/database.types';

const selectClass =
  'border-input h-10 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm';

export function OrganizationForm() {
  const t = useTranslations('org');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(createOrganization, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t('name')}</Label>
        <Input id="name" name="name" required autoComplete="organization" defaultValue={v.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="country">{t('country')}</Label>
        <select id="country" name="country" className={selectClass} defaultValue={v.country ?? (locale === 'hr' ? 'HR' : locale === 'bs' ? 'BA' : locale === 'sr-Latn' ? 'RS' : 'SI')}>
          {ORG_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {t(`countries.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('kind')}</legend>
        {Constants.public.Enums.org_kind.map((k) => (
          <label key={k} className="flex items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary">
            <input type="radio" name="kind" value={k} defaultChecked={(v.kind ?? 'operator') === k} className="mt-0.5" />
            {t(`kinds.${k}`)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="size">{t('size')}</Label>
        <select id="size" name="size" className={selectClass} defaultValue={v.size ?? 'small'}>
          {Constants.public.Enums.org_size.map((s) => (
            <option key={s} value={s}>
              {t(`sizes.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="wasUnderEutr" defaultChecked={v.wasUnderEutr === 'on'} className="mt-0.5" />
        {t('wasUnderEutr')}
      </label>
      {(['taxId', 'registrationNo', 'eori'] as const).map((f) => (
        <div key={f} className="flex flex-col gap-2">
          <Label htmlFor={f}>
            {t(f)} <span className="text-muted-foreground font-normal">({t('optional')})</span>
          </Label>
          <Input id={f} name={f} defaultValue={v[f]} />
        </div>
      ))}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {t('create')}
      </Button>
    </form>
  );
}
