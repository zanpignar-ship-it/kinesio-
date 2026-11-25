"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ActionForm, Field, SelectField, Submit, TextareaField } from "@/components/form";
import { Button, cx, inputClass, Label, Money } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ActionState } from "@/server/action";
import type { QuoteResult } from "../actions";

type ListingOpt = { id: string; title: string; units: number; depositCents: number };
type CustomerOpt = { id: string; label: string; discount: number };

export function ReservationBuilder(props: {
  listings: ListingOpt[]; customers: CustomerOpt[]; sources: { value: string; label: string }[];
  defaults: { start: string; end: string; listingId?: string; customerId?: string };
  createAction: (s: ActionState, fd: FormData) => Promise<ActionState>;
  quoteAction: (ids: string[], start: string, end: string) => Promise<QuoteResult>;
}) {
  const { listings, customers, defaults } = props;
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [items, setItems] = useState<{ listingId: string; quantity: number }[]>(defaults.listingId ? [{ listingId: defaults.listingId, quantity: 1 }] : []);
  const [customerId, setCustomerId] = useState(defaults.customerId ?? "");
  const [quotes, setQuotes] = useState<QuoteResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState("");

  const ids = useMemo(() => items.map((i) => i.listingId).join(","), [items]);
  useEffect(() => {
    if (!ids) { setQuotes(null); return; }
    const h = setTimeout(() => startTransition(async () => setQuotes(await props.quoteAction(ids.split(","), start, end))), 250);
    return () => clearTimeout(h);
  }, [ids, start, end, props]);

  const quoteFor = (id: string) => (Array.isArray(quotes) ? quotes.find((q) => q.listingId === id) : undefined);
  const subtotal = items.reduce((s, i) => s + (quoteFor(i.listingId)?.unitPriceCents ?? 0) * i.quantity, 0);
  const discount = customers.find((c) => c.id === customerId)?.discount ?? 0;
  const discountCents = Math.round((subtotal * discount) / 100);
  const deposit = items.reduce((s, i) => s + (listings.find((l) => l.id === i.listingId)?.depositCents ?? 0) * i.quantity, 0);
  const days = Array.isArray(quotes) ? quotes[0]?.days : undefined;
  const conflict = items.some((i) => { const q = quoteFor(i.listingId); return q && q.available < i.quantity; });
  const remaining = listings.filter((l) => !items.some((i) => i.listingId === l.id));

  return (
    <ActionForm action={props.createAction} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded-md border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Stranka in vir</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="f-customerId">Stranka</Label>
              <div className="flex gap-2">
                <select id="f-customerId" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass} required>
                  <option value="">Izberite stranko …</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <Link href={`/app/customers/new?next=${encodeURIComponent("/app/reservations/new")}`} className="inline-flex h-10 shrink-0 items-center rounded-sm border border-line-strong bg-surface px-3 text-sm hover:border-ink/40">Nova</Link>
              </div>
            </div>
            <SelectField name="source" label="Kako je stranka prišla" options={props.sources} defaultValue="phone" />
            <SelectField name="status" label="Stanje" defaultValue="confirmed" options={[
              { value: "confirmed", label: "Potrjena" }, { value: "awaiting_confirmation", label: "Čaka potrditev" }, { value: "quotation", label: "Ponudba" }, { value: "draft", label: "Osnutek" }]} />
          </div>
          <p className="mt-3 text-xs text-steel">Provizija RENTORA se obračuna samo za rezervacije, pridobljene prek tržnice. Neposredne stranke so brez provizije.</p>
        </section>

        <section className="rounded-md border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Termin</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="start" label="Prevzem" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            <Field name="end" label="Vračilo" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          {quotes && !Array.isArray(quotes) && <p className="mt-2 text-sm text-bad">{quotes.error}</p>}
        </section>

        <section className="rounded-md border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Oprema</h2>
          {items.length === 0 && <p className="mb-4 text-sm text-steel">Dodajte artikle. Enote se dodelijo samodejno; zamenjate jih lahko na rezervaciji.</p>}
          <ul className="divide-y divide-line">
            {items.map((it, idx) => {
              const l = listings.find((x) => x.id === it.listingId)!;
              const q = quoteFor(it.listingId);
              const short = q && q.available < it.quantity;
              return (
                <li key={it.listingId} className="flex flex-wrap items-center gap-3 py-3">
                  <input type="hidden" name="listingId" value={it.listingId} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className={cx("text-xs", short ? "text-bad" : "text-steel")} aria-live="polite">
                      {pending && !q ? "Preverjanje …" : q ? `Prosto ${q.available} od ${l.units}` : ""}
                    </p>
                  </div>
                  <label className="sr-only" htmlFor={`q-${idx}`}>Količina</label>
                  <input id={`q-${idx}`} name="quantity" type="number" min={1} max={Math.max(1, l.units)} value={it.quantity}
                    onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))}
                    className={cx(inputClass, "w-20 text-right tabular", short && "border-bad")} />
                  <span className="w-24 text-right text-sm tabular">{q ? <Money cents={q.unitPriceCents * it.quantity} /> : "—"}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label={`Odstrani ${l.title}`}>Odstrani</Button>
                </li>
              );
            })}
          </ul>
          {remaining.length > 0 && (
            <div className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="add-item">Dodaj artikel</label>
              <select id="add-item" value={adding} onChange={(e) => setAdding(e.target.value)} className={inputClass}>
                <option value="">Dodaj artikel …</option>
                {remaining.map((l) => <option key={l.id} value={l.id} disabled={l.units === 0}>{l.title}{l.units === 0 ? " (brez enot)" : ""}</option>)}
              </select>
              <Button type="button" variant="secondary" disabled={!adding} onClick={() => { setItems([...items, { listingId: adding, quantity: 1 }]); setAdding(""); }}>
                <Icon name="plus" className="size-4" />Dodaj
              </Button>
            </div>
          )}
        </section>
        <TextareaField name="notes" label="Opombe" hint="neobvezno" rows={3} />
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-md border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Povzetek</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-steel">Obračunski dnevi</dt><dd className="tabular">{days ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-steel">Najemnina</dt><dd><Money cents={subtotal} /></dd></div>
            {discount > 0 && <div className="flex justify-between"><dt className="text-steel">Popust stranke {discount} %</dt><dd>−<Money cents={discountCents} /></dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Skupaj z DDV</dt><dd><Money cents={subtotal - discountCents} /></dd></div>
            <div className="flex justify-between"><dt className="text-steel">Varščina</dt><dd><Money cents={deposit} /></dd></div>
          </dl>
          {conflict && <p role="alert" className="mt-4 rounded-sm bg-bad-soft px-3 py-2 text-sm text-bad">V izbranem terminu ni dovolj prostih enot. Spremenite termin ali količino.</p>}
          <Submit className="mt-5 w-full" size="lg" pendingLabel="Ustvarjanje …">Ustvari rezervacijo</Submit>
          <p className="mt-3 text-xs text-mute">Razpoložljivost se ob shranjevanju ponovno preveri na strežniku, zato dvojna rezervacija ni mogoča.</p>
        </div>
      </aside>
    </ActionForm>
  );
}
