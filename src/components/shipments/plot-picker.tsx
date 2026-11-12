'use client';

import { useMemo, useState } from 'react';
import type * as GeoJSON from 'geojson';
import { useTranslations } from 'next-intl';
import { MultiPicker } from '@/components/forms/multi-picker';
import { PlotMapClient } from '@/components/map/map-client';
import { Button } from '@/components/ui/button';

type Props = {
  items: { id: string; label: string }[];
  map: GeoJSON.FeatureCollection;
  initial: string[];
  /** Controlled mode: the shipment form needs the selection for the products' plots. */
  value?: Set<string>;
  onChange?: (next: Set<string>) => void;
};

/** Plots of a shipment: tick them in the list or tap them on the map (selected plots are outlined in blue). */
export function PlotPicker({ items, map, initial, value, onChange }: Props) {
  const t = useTranslations('ship');
  const tAll = useTranslations();
  const [own, setOwn] = useState<Set<string>>(new Set(initial));
  const selected = value ?? own;
  const setSelected = (update: Set<string> | ((s: Set<string>) => Set<string>)) => {
    const next = typeof update === 'function' ? update(selected) : update;
    if (onChange) onChange(next);
    else setOwn(next);
  };
  const [showMap, setShowMap] = useState(false);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({ ...map, features: map.features.map((f) => ({ ...f, properties: { ...f.properties, selected: selected.has(String(f.properties?.id)) } })) }),
    [map, selected],
  );
  return (
    <MultiPicker
      name="plotIds"
      items={items}
      initial={initial}
      value={selected}
      onChange={setSelected}
      legend={t('plots')}
      searchLabel={tAll('documents.searchPlots')}
      emptyText={tAll('documents.noPlots')}
      selectedText={(n) => tAll('documents.selected', { count: n })}
    >
      {map.features.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
            {showMap ? t('hideMap') : t('pickOnMap')}
          </Button>
          {showMap ? (
            <>
              <p className="text-muted-foreground text-xs">{t('pickOnMapHint')}</p>
              <div data-testid="plot-picker-map">
                <PlotMapClient className="h-[50vh] min-h-72" plots={data} onPlotClick={toggle} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </MultiPicker>
  );
}
