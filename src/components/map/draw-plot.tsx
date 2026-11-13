'use client';

import { useActionState, useReducer } from 'react';
import type * as GeoJSON from 'geojson';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { IssueList } from '@/components/plots/issue-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPlot, updatePlot } from '@/app/[locale]/app/plots/actions';
import { ORG_COUNTRIES } from '@/lib/auth/schemas';
import { validatePlot } from '@/lib/geo/validate';
import { drawReducer, initialDraw, toGeometry, type DrawState } from '@/lib/map/draw-state';
import { showsAreaField } from '@/lib/plots/area-field';
import { PlotMapClient } from './map-client';

type Initial = {
  id?: string;
  label?: string;
  country: string;
  declaredAreaHa?: number | null;
  cadastralNo?: string | null;
  cadastralMunicipality?: string | null;
  supplierId?: string | null;
  harvestFrom?: string | null;
  harvestTo?: string | null;
  draw: DrawState | null;
  multiPart?: boolean;
  geometry?: GeoJSON.Geometry | null;
};

const selectClass = 'border-input h-10 w-full rounded-md border bg-card px-3 text-base shadow-xs md:text-sm';

export function DrawPlot({ initial, others, suppliers = [] }: { initial: Initial; others?: GeoJSON.FeatureCollection; suppliers?: { id: string; name: string }[] }) {
  const t = useTranslations('draw');
  const tp = useTranslations('plots');
  const to = useTranslations('org');
  const tAll = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const [draw, dispatch] = useReducer(drawReducer, initial.draw ?? initialDraw('polygon'));
  const [state, action, pending] = useActionState(initial.id ? updatePlot : createPlot, {});
  const v = state.values ?? {};
  const [country, setCountry] = useReducer((_: string, next: string) => next, initial.country);
  const [declared, setDeclared] = useReducer((_: string, next: string) => next, initial.declaredAreaHa != null ? String(initial.declaredAreaHa) : '');

  const { geometry, problem } = initial.multiPart ? { geometry: (initial.geometry ?? null) as never, problem: null } : toGeometry(draw);
  const declaredNumber = declared.trim() === '' ? undefined : Number(declared.replace(',', '.'));
  const check = geometry
    ? validatePlot({ geometry, country, declaredAreaHa: Number.isFinite(declaredNumber) ? declaredNumber : undefined, decimals: null })
    : null;

  return (
    <form action={action} className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="flex flex-col gap-3">
        {initial.multiPart ? (
          <p className="text-muted-foreground text-sm">{t('multiPart')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(['point', 'polygon'] as const).map((m) => (
                <Button key={m} type="button" variant={draw.mode === m ? 'default' : 'outline'} aria-pressed={draw.mode === m} onClick={() => dispatch({ type: 'mode', mode: m })} className="h-11">
                  {t(m)}
                </Button>
              ))}
              <Button type="button" variant="outline" onClick={() => dispatch({ type: 'undo' })} disabled={draw.vertices.length === 0} className="h-11">
                {t('undo')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => dispatch({ type: 'clear' })} disabled={draw.vertices.length === 0} className="h-11">
                {t('clear')}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">{draw.mode === 'point' ? t('hintPoint') : t('hintPolygon')}</p>
          </>
        )}
        <PlotMapClient
          className="h-[55vh] min-h-80"
          plots={others}
          draft={initial.multiPart ? undefined : draw}
          onAdd={initial.multiPart ? undefined : (p) => dispatch({ type: 'add', position: p })}
          onMove={(i, p) => dispatch({ type: 'move', index: i, position: p })}
        />
      </div>

      <div className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="geometry" value={geometry ? JSON.stringify(geometry) : ''} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="label">{tp('label')}</Label>
          <Input id="label" name="label" required defaultValue={v.label ?? initial.label} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="country">{tp('country')}</Label>
          <select id="country" name="country" className={selectClass} value={country} onChange={(e) => setCountry(e.target.value)}>
            {ORG_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {to(`countries.${c}`)}
              </option>
            ))}
          </select>
        </div>
        {showsAreaField(draw.mode, initial.multiPart ? (initial.geometry?.type ?? null) : null) ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="declaredAreaHa">{t('declaredArea')}</Label>
            <Input id="declaredAreaHa" name="declaredAreaHa" inputMode="decimal" value={declared} onChange={(e) => setDeclared(e.target.value)} />
            <p className="text-muted-foreground text-xs">{t('declaredAreaHint')}</p>
          </div>
        ) : null}
        {suppliers.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplierId">{tp('supplier')}</Label>
            <select id="supplierId" name="supplierId" className={selectClass} defaultValue={v.supplierId ?? initial.supplierId ?? ''}>
              <option value="">{tp('noSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{tp('harvest')}</legend>
          <p className="text-muted-foreground text-xs">{tp('harvestHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="harvestFrom" className="text-xs">{tp('harvestFrom')}</Label>
              <Input id="harvestFrom" name="harvestFrom" type="date" defaultValue={v.harvestFrom ?? initial.harvestFrom ?? ''} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="harvestTo" className="text-xs">{tp('harvestTo')}</Label>
              <Input id="harvestTo" name="harvestTo" type="date" defaultValue={v.harvestTo ?? initial.harvestTo ?? ''} />
            </div>
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cadastralNo">{tp('cadastral')}</Label>
          <Input id="cadastralNo" name="cadastralNo" defaultValue={v.cadastralNo ?? initial.cadastralNo ?? ''} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cadastralMunicipality">{tp('cadastralMunicipality')}</Label>
          <Input id="cadastralMunicipality" name="cadastralMunicipality" defaultValue={v.cadastralMunicipality ?? initial.cadastralMunicipality ?? ''} />
        </div>

        <section className="flex flex-col gap-2" aria-live="polite">
          {problem ? <p className="text-sm font-medium">{t(problem)}</p> : null}
          {check?.areaHa != null && geometry && geometry.type !== 'Point' ? (
            <p className="text-sm">{t('area', { value: format.number(check.areaHa, { maximumFractionDigits: 2 }) })}</p>
          ) : null}
          {check ? <IssueList issues={check.issues} /> : null}
        </section>

        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {tAll(state.error)}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || Boolean(problem)} className="h-12">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
