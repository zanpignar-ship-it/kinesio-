'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Plot = { id: string; label: string };

/** Checkbox list of plots with a search box; selected ids are submitted as a comma list in `plotIds`. */
export function PlotPicker({ plots, initial }: { plots: Plot[]; initial: string[] }) {
  const t = useTranslations('documents');
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState('');
  const shown = plots.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 200);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{t('plots')}</legend>
      <p className="text-muted-foreground text-xs">{t('plotsHint')}</p>
      <input type="hidden" name="plotIds" value={[...selected].join(',')} />
      {plots.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noPlots')}</p>
      ) : (
        <>
          <input
            type="search"
            aria-label={t('searchPlots')}
            placeholder={t('searchPlots')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border-input h-10 rounded-md border bg-card px-3 text-base md:text-sm"
          />
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 items-center gap-3 px-3 text-sm">
                  <input type="checkbox" className="size-5" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  {p.label}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">{t('selected', { count: selected.size })}</p>
        </>
      )}
    </fieldset>
  );
}
