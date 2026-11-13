'use client';

import { useActionState, useEffect, useReducer, useRef } from 'react';
import type * as GeoJSON from 'geojson';
import { useLocale, useTranslations } from 'next-intl';
import { PlotMapClient } from '@/components/map/map-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { portalAddPlot } from '@/app/[locale]/supply/[token]/actions';
import { drawReducer, initialDraw, toGeometry } from '@/lib/map/draw-state';

/** The supplier marks a plot (point or outline) on the satellite map; it is stored for the operator to review. */
export function PortalPlotForm({ token, existing }: { token: string; existing: GeoJSON.FeatureCollection }) {
  const t = useTranslations('portal');
  const td = useTranslations('draw');
  const tp = useTranslations('plots');
  const tAll = useTranslations();
  const locale = useLocale();
  const [draw, dispatch] = useReducer(drawReducer, initialDraw('polygon'));
  const [state, action, pending] = useActionState(portalAddPlot, {});
  const form = useRef<HTMLFormElement>(null);
  const { geometry } = toGeometry(draw);
  useEffect(() => {
    if (state.saved) {
      form.current?.reset();
      dispatch({ type: 'clear' });
    }
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3" data-testid="portal-plot-form">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="geometry" value={geometry ? JSON.stringify(geometry) : ''} />
      <div className="flex flex-wrap gap-2">
        {(['point', 'polygon'] as const).map((m) => (
          <Button key={m} type="button" variant={draw.mode === m ? 'default' : 'outline'} aria-pressed={draw.mode === m} onClick={() => dispatch({ type: 'mode', mode: m })}>
            {td(m)}
          </Button>
        ))}
        <Button type="button" variant="outline" onClick={() => dispatch({ type: 'undo' })} disabled={draw.vertices.length === 0}>
          {td('undo')}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{draw.mode === 'point' ? td('hintPoint') : td('hintPolygon')}</p>
      <div data-testid="portal-map">
        <PlotMapClient
          className="h-[50vh] min-h-72"
          plots={existing}
          draft={draw}
          onAdd={(p) => dispatch({ type: 'add', position: p })}
          onMove={(i, p) => dispatch({ type: 'move', index: i, position: p })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-label">{t('plotName')}</Label>
          <Input id="portal-label" name="label" required />
        </div>
        {draw.mode === 'point' ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="portal-area">{td('declaredArea')}</Label>
            <Input id="portal-area" name="areaHa" inputMode="decimal" />
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-hfrom">
            {tp('harvest')} – {tp('harvestFrom')}
          </Label>
          <Input id="portal-hfrom" name="harvestFrom" type="date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="portal-hto">
            {tp('harvest')} – {tp('harvestTo')}
          </Label>
          <Input id="portal-hto" name="harvestTo" type="date" />
        </div>
      </div>
      <Button type="submit" className="self-start" disabled={pending || !geometry}>
        {t('addPlot')}
      </Button>
      {state.saved ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {t('plotSaved')}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(state.error)}
        </p>
      ) : null}
    </form>
  );
}
