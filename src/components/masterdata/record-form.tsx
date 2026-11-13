'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteRecord, saveRecord } from '@/app/[locale]/app/master-data/actions';
import { Constants } from '@/lib/db/database.types';
import { FIELDS, type Entity } from '@/lib/masterdata/config';
import type { Options } from '@/lib/masterdata/queries';
import { COUNTRIES } from '@/lib/masterdata/schemas';

const selectClass = 'border-input h-10 w-full rounded-md border bg-card px-3 text-base shadow-xs md:text-sm';

type Props = { entity: Entity; id?: string; values?: Record<string, string>; options?: Options; defaultCountry: string };

export function RecordForm({ entity, id, values = {}, options, defaultCountry }: Props) {
  const t = useTranslations('md');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveRecord, {});
  const [delState, del, deleting] = useActionState(deleteRecord, {});
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const error = state.error ?? delState.error;
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="locale" value={locale} />
        {id ? <input type="hidden" name="id" value={id} /> : null}
        {FIELDS[entity].map((f) => (
          <div key={f.name} className="flex flex-col gap-2">
            <Label htmlFor={f.name}>{t(`fields.${f.name}`)}</Label>
            {f.type === 'country' ? (
              <select id={f.name} name={f.name} className={selectClass} defaultValue={values[f.name] || defaultCountry}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {regions.of(c) ?? c}
                  </option>
                ))}
              </select>
            ) : f.type === 'hsCode' ? (
              <select id={f.name} name={f.name} className={selectClass} defaultValue={values[f.name] || '4403'}>
                {(options?.hsCodes ?? []).map((h) => (
                  <option key={h.code} value={h.code}>
                    {h.inScope ? h.label : `${h.label} (${t('outOfScope')})`}
                  </option>
                ))}
              </select>
            ) : f.type === 'species' ? (
              <select id={f.name} name={f.name} className={selectClass} defaultValue={values[f.name] || ''}>
                <option value="">{t('fields.speciesNone')}</option>
                {(options?.species ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'supplierKind' ? (
              <select id={f.name} name={f.name} className={selectClass} defaultValue={values[f.name] || 'forest_owner'}>
                {Constants.public.Enums.supplier_kind.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </select>
            ) : (
              <Input id={f.name} name={f.name} type={f.type === 'email' ? 'email' : 'text'} required={f.required} defaultValue={values[f.name]} />
            )}
          </div>
        ))}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {tAll(error)}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending} className="self-start">
          {t('save')}
        </Button>
      </form>
      {id ? (
        <form
          action={del}
          onSubmit={(e) => {
            if (!window.confirm(t('deleteConfirm'))) e.preventDefault();
          }}
        >
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" disabled={deleting}>
            {t('delete')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
