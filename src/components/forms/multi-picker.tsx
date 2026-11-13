'use client';

import { useState } from 'react';

type Item = { id: string; label: string };
type Props = {
  name: string;
  items: Item[];
  initial: string[];
  legend: string;
  hint?: string;
  searchLabel: string;
  emptyText: string;
  selectedText: (n: number) => string;
  /** Controlled mode (e.g. together with a map): the parent owns the selection. */
  value?: Set<string>;
  onChange?: (next: Set<string>) => void;
  children?: React.ReactNode;
};

/** Searchable checkbox list; the selected ids are submitted as a comma list in `name`. */
export function MultiPicker({ name, items, initial, legend, hint, searchLabel, emptyText, selectedText, value, onChange, children }: Props) {
  const [own, setOwn] = useState<Set<string>>(new Set(initial));
  const selected = value ?? own;
  const setSelected = (update: (s: Set<string>) => Set<string>) => {
    const next = update(selected);
    if (onChange) onChange(next);
    else setOwn(next);
  };
  const [q, setQ] = useState('');
  const shown = items.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 300);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      <input type="hidden" name={name} value={[...selected].join(',')} />
      {children}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        <>
          {items.length > 8 ? (
            <input
              type="search"
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-input h-10 rounded-md border bg-card px-3 text-base md:text-sm"
            />
          ) : null}
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
          <p className="text-muted-foreground text-xs">{selectedText(selected.size)}</p>
        </>
      )}
    </fieldset>
  );
}
