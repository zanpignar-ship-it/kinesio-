'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MultiPicker } from '@/components/forms/multi-picker';
import { PlotPicker } from './plot-picker';
import type * as GeoJSON from 'geojson';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveShipment } from '@/app/[locale]/app/shipments/actions';
import { ORG_COUNTRIES } from '@/lib/auth/schemas';
import { Constants } from '@/lib/db/database.types';

type Opt = { id: string; label: string };
type Item = { productId: string; netMassKg: string; volumeM3: string; pieces: string; plotIds?: string[] };
type Ref = { kind: 'dds' | 'simplified_declaration'; referenceNo: string; verificationNo: string; supplierId: string };
export type ShipmentFormInitial = {
  id?: string;
  internalRef?: string;
  customerId?: string | null;
  shipmentDate?: string | null;
  mode?: 'submit_dds' | 'forward_references';
  activity?: 'domestic' | 'import' | 'export';
  countryOfProduction?: string | null;
  items?: Item[];
  plotIds?: string[];
  documentIds?: string[];
  references?: Ref[];
};
type Props = {
  options: { customers: { id: string; name: string }[]; products: Opt[]; suppliers: { id: string; name: string }[]; plots: Opt[]; documents: Opt[]; plotsMap: GeoJSON.FeatureCollection };
  initial: ShipmentFormInitial;
  defaultCountry: string;
};

const selectClass = 'border-input h-10 w-full rounded-md border bg-card px-3 text-base shadow-xs md:text-sm';

export function ShipmentForm({ options, initial, defaultCountry }: Props) {
  const t = useTranslations('ship');
  const to = useTranslations('org');
  const tAll = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveShipment, {});
  const [mode, setMode] = useState(initial.mode ?? 'submit_dds');
  const [items, setItems] = useState<Item[]>(initial.items?.length ? initial.items : [{ productId: options.products[0]?.id ?? '', netMassKg: '', volumeM3: '', pieces: '' }]);
  const [refs, setRefs] = useState<Ref[]>(initial.references ?? []);
  const [plotIds, setPlotIds] = useState<Set<string>>(new Set(initial.plotIds ?? []));
  const plotLabel = new Map(options.plots.map((p) => [p.id, p.label]));
  const shipmentPlots = [...plotIds].filter((id) => plotLabel.has(id));
  const toggleItemPlot = (i: number, id: string) =>
    setItems((xs) =>
      xs.map((x, n) => {
        if (n !== i) return x;
        const current = new Set(x.plotIds?.length ? x.plotIds : shipmentPlots);
        if (current.has(id)) current.delete(id);
        else current.add(id);
        return { ...x, plotIds: current.size === shipmentPlots.length ? [] : [...current] };
      }),
    );
  const setItem = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const setRef = (i: number, patch: Partial<Ref>) => setRefs((xs) => xs.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="references" value={JSON.stringify(mode === 'forward_references' ? refs : [])} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="internalRef">{t('internalRef')}</Label>
          <Input id="internalRef" name="internalRef" required defaultValue={initial.internalRef} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="shipmentDate">{t('date')}</Label>
          <Input id="shipmentDate" name="shipmentDate" type="date" defaultValue={initial.shipmentDate ?? ''} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerId">{t('customer')}</Label>
          <select id="customerId" name="customerId" className={selectClass} defaultValue={initial.customerId ?? ''}>
            <option value="">{t('none')}</option>
            {options.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity">{t('activity')}</Label>
          <select id="activity" name="activity" className={selectClass} defaultValue={initial.activity ?? 'export'}>
            {Constants.public.Enums.shipment_activity.map((a) => (
              <option key={a} value={a}>
                {t(`activities.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="countryOfProduction">{t('countryOfProduction')}</Label>
          <select id="countryOfProduction" name="countryOfProduction" className={selectClass} defaultValue={initial.countryOfProduction ?? defaultCountry}>
            {ORG_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {to(`countries.${c}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('mode')}</legend>
        {Constants.public.Enums.shipment_mode.map((m) => (
          <label key={m} className="has-[:checked]:border-primary flex items-start gap-3 rounded-md border p-3 text-sm">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 size-4" />
            {t(`modes.${m}`)}
          </label>
        ))}
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('items')}</h2>
        {options.products.length === 0 ? <p className="text-muted-foreground text-sm">{t('noProducts')}</p> : null}
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`product-${i}`}>{t('product')}</Label>
              <select id={`product-${i}`} className={selectClass} value={it.productId} onChange={(e) => setItem(i, { productId: e.target.value })}>
                <option value="">{t('none')}</option>
                {options.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {(['netMassKg', 'volumeM3', 'pieces'] as const).map((q) => (
              <div key={q} className="flex flex-col gap-1">
                <Label htmlFor={`${q}-${i}`}>{t(q)}</Label>
                <Input id={`${q}-${i}`} inputMode="decimal" value={it[q]} onChange={(e) => setItem(i, { [q]: e.target.value })} />
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={() => setItems((xs) => xs.filter((_, n) => n !== i))} disabled={items.length === 1}>
              {t('remove')}
            </Button>
            {items.length > 1 && shipmentPlots.length > 1 ? (
              <details className="text-sm sm:col-span-5" data-testid={`item-plots-${i}`}>
                <summary className="cursor-pointer">
                  {it.plotIds?.length ? t('itemPlotsSome', { count: it.plotIds.length, total: shipmentPlots.length }) : t('itemPlotsAll')}
                </summary>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {shipmentPlots.map((id) => (
                    <label key={id} className="flex items-center gap-2">
                      <input type="checkbox" className="size-4" checked={!it.plotIds?.length || it.plotIds.includes(id)} onChange={() => toggleItemPlot(i, id)} />
                      {plotLabel.get(id)}
                    </label>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="outline" className="self-start" onClick={() => setItems((xs) => [...xs, { productId: options.products[0]?.id ?? '', netMassKg: '', volumeM3: '', pieces: '' }])}>
          {t('addItem')}
        </Button>
      </section>

      <PlotPicker items={options.plots} map={options.plotsMap} initial={initial.plotIds ?? []} value={plotIds} onChange={setPlotIds} />
      <MultiPicker
        name="documentIds"
        items={options.documents}
        initial={initial.documentIds ?? []}
        legend={t('documents')}
        searchLabel={tAll('documents.title')}
        emptyText={tAll('documents.empty')}
        selectedText={(n) => tAll('documents.selected', { count: n })}
      />

      {mode === 'forward_references' ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('references')}</h2>
          {refs.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`refKind-${i}`}>{t('refKind')}</Label>
                <select id={`refKind-${i}`} className={selectClass} value={r.kind} onChange={(e) => setRef(i, { kind: e.target.value as Ref['kind'] })}>
                  {Constants.public.Enums.upstream_ref_kind.map((k) => (
                    <option key={k} value={k}>
                      {t(`refKinds.${k}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`refSupplier-${i}`}>{t('supplier')}</Label>
                <select id={`refSupplier-${i}`} className={selectClass} value={r.supplierId} onChange={(e) => setRef(i, { supplierId: e.target.value })}>
                  <option value="">{t('none')}</option>
                  {options.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`refNo-${i}`}>{t('referenceNo')}</Label>
                <Input id={`refNo-${i}`} value={r.referenceNo} onChange={(e) => setRef(i, { referenceNo: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`refVer-${i}`}>{t('verificationNo')}</Label>
                <Input id={`refVer-${i}`} value={r.verificationNo} onChange={(e) => setRef(i, { verificationNo: e.target.value })} />
              </div>
              <Button type="button" variant="ghost" className="self-start" onClick={() => setRefs((xs) => xs.filter((_, n) => n !== i))}>
                {t('remove')}
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="self-start" onClick={() => setRefs((xs) => [...xs, { kind: 'dds', referenceNo: '', verificationNo: '', supplierId: '' }])}>
            {t('addReference')}
          </Button>
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 self-start" disabled={pending}>
        {t('save')}
      </Button>
    </form>
  );
}
