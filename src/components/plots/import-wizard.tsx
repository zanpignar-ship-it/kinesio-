'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import type * as GeoJSON from 'geojson';
import { useLocale, useTranslations } from 'next-intl';
import { PlotMapClient } from '@/components/map/map-client';
import { IssueList } from '@/components/plots/issue-list';
import { StatusBadge } from '@/components/plots/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { importPlots, type ImportResult } from '@/app/[locale]/app/plots/actions';
import { Link } from '@/i18n/navigation';
import { ORG_COUNTRIES } from '@/lib/auth/schemas';
import { parsePlotFile, type ParseResult } from '@/lib/geo/parse';
import type { SupportedCrs } from '@/lib/geo/reproject';
import { previewImport, selectImportRows } from '@/lib/plots/import-selection';
import { createBrowserSupabase } from '@/lib/supabase/browser';

type Props = { organizationId: string; defaultCountry: string; suppliers?: { id: string; name: string }[] };

const PREVIEW_ROWS = 100;
const selectClass = 'border-input h-10 w-full max-w-xs rounded-md border bg-transparent px-3 text-base shadow-xs md:text-sm';

export function ImportWizard({ organizationId, defaultCountry, suppliers = [] }: Props) {
  const t = useTranslations('imp');
  const to = useTranslations('org');
  const tAll = useTranslations();
  const locale = useLocale();
  const [file, setFile] = useState<{ name: string; data: Uint8Array; type: string } | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [crs, setCrs] = useState<SupportedCrs | null>(null);
  // The file had no coordinate system: keep the choice visible (and changeable) after the user picks one.
  const [crsAsked, setCrsAsked] = useState(false);
  const [country, setCountry] = useState(defaultCountry);
  const [supplierId, setSupplierId] = useState('');
  const [harvestFrom, setHarvestFrom] = useState('');
  const [harvestTo, setHarvestTo] = useState('');
  const [includeErrors, setIncludeErrors] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saving, startSaving] = useTransition();

  const needsCrs = crsAsked && !crs;
  const preview = useMemo(() => (parsed && !needsCrs ? previewImport(parsed.features, country, t('unnamed')) : null), [parsed, needsCrs, country, t]);
  const rows = preview ? selectImportRows(preview.items, includeErrors) : [];

  // Only the latest parse may update the screen (quick D96/D48 switches can finish out of order).
  const parseRun = useRef(0);
  const parse = async (f: { name: string; data: Uint8Array }, chosen: SupportedCrs | null) => {
    const run = ++parseRun.current;
    setParsing(true);
    try {
      const result = await parsePlotFile(f.name, f.data, chosen ? { crs: chosen } : {});
      if (run !== parseRun.current) return;
      if (!chosen) setCrsAsked(result.crsIssue?.code === 'CRS_GUESSED');
      setParsed(result);
    } finally {
      if (run === parseRun.current) setParsing(false);
    }
  };

  const onFile = async (input: HTMLInputElement) => {
    const chosen = input.files?.[0];
    if (!chosen) return;
    const data = new Uint8Array(await chosen.arrayBuffer());
    const f = { name: chosen.name, data, type: chosen.type || 'application/octet-stream' };
    setFile(f);
    setCrs(null);
    setResult(null);
    await parse(f, null);
  };

  const chooseCrs = async (value: SupportedCrs) => {
    setCrs(value);
    if (file) await parse(file, value);
  };

  const save = () =>
    startSaving(async () => {
      if (!file || !parsed) return;
      // Keep the original file for inspections; the import still works if this upload fails.
      let filePath: string | null = `${organizationId}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const upload = await createBrowserSupabase().storage.from('plot-imports').upload(filePath, file.data, { contentType: file.type, upsert: false });
      if (upload.error) filePath = null;
      try {
        setResult(await importPlots({ locale, country, fileName: file.name, filePath, detectedCrs: crs ?? parsed.detectedCrs, supplierId: supplierId || null, harvestFrom: harvestFrom || null, harvestTo: harvestTo || null, rows }));
      } catch {
        setResult({ error: 'plots.errors.unknown' });
      }
    });

  if (result?.inserted !== undefined) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border p-6">
        <p className="font-medium">{t('done', { count: result.inserted })}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/app/plots">{t('toList')}</Link>
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setParsed(null); setResult(null); setCrs(null); setCrsAsked(false); }}>
            {t('another')}
          </Button>
        </div>
      </div>
    );
  }

  const fileIssues = parsed ? [...(parsed.crsIssue && !crs ? [parsed.crsIssue] : []), ...parsed.issues] : [];
  const mapData: GeoJSON.FeatureCollection | undefined = preview
    ? {
        type: 'FeatureCollection',
        features: preview.items.flatMap((i) =>
          i.normalized ? [{ type: 'Feature' as const, properties: { id: `row-${i.index}`, label: i.label, validation_status: i.status }, geometry: i.normalized }] : [],
        ),
      }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">{t('chooseFile')}</Label>
        <input
          id="file"
          type="file"
          accept=".geojson,.json,.kml,.kmz,.zip,.csv,.txt"
          onChange={(e) => void onFile(e.currentTarget)}
          className="file:bg-primary file:text-primary-foreground text-sm file:mr-3 file:h-11 file:rounded-md file:border-0 file:px-4"
        />
        <p className="text-muted-foreground text-sm">{t('formats')}</p>
      </div>

      {parsing ? <p className="text-sm">{t('parsing')}</p> : null}

      {fileIssues.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t('fileIssues')}</h2>
          <IssueList issues={fileIssues} />
        </section>
      ) : null}

      {crsAsked ? (
        <fieldset className="flex flex-col gap-2 rounded-xl border p-4">
          <legend className="px-1 font-semibold">{t('crsTitle')}</legend>
          {(['EPSG:3794', 'EPSG:3912'] as const).map((c) => (
            <label key={c} className="flex items-center gap-3 text-sm">
              <input type="radio" name="crs" value={c} checked={crs === c} onChange={() => void chooseCrs(c)} className="size-5" />
              {c === 'EPSG:3794' ? t('crsD96') : t('crsD48')}
            </label>
          ))}
        </fieldset>
      ) : null}

      {preview ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="country">{t('country')}</Label>
            <select id="country" className={selectClass} value={country} onChange={(e) => setCountry(e.target.value)}>
              {ORG_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {to(`countries.${c}`)}
                </option>
              ))}
            </select>
          </div>
          {suppliers.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="supplier">{tAll('plots.supplier')}</Label>
              <select id="supplier" className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">{tAll('plots.noSupplier')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{tAll('plots.harvest')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="harvestFrom" className="text-xs">{tAll('plots.harvestFrom')}</Label>
                <input id="harvestFrom" type="date" className={selectClass} value={harvestFrom} onChange={(e) => setHarvestFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="harvestTo" className="text-xs">{tAll('plots.harvestTo')}</Label>
                <input id="harvestTo" type="date" className={selectClass} value={harvestTo} onChange={(e) => setHarvestTo(e.target.value)} />
              </div>
            </div>
          </fieldset>
          {preview.items.length === 0 ? (
            <p>{t('empty')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-medium">{t('summary', { count: preview.items.length })}</p>
                {(['valid', 'warning', 'error'] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1 text-sm">
                    <StatusBadge status={s} /> <span data-testid={`import-count-${s}`}>{preview.counts[s]}</span>
                  </span>
                ))}
              </div>
              {mapData && mapData.features.length > 0 ? <PlotMapClient className="h-[40vh] min-h-64" plots={mapData} /> : null}
              <ul className="divide-y rounded-xl border">
                {preview.items.slice(0, PREVIEW_ROWS).map((i) => (
                  <li key={i.index} data-testid="import-row" className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex-1 font-medium">{i.label}</span>
                      <StatusBadge status={i.status} />
                    </div>
                    {i.status !== 'valid' ? <IssueList issues={i.issues} /> : null}
                  </li>
                ))}
              </ul>
              {preview.items.length > PREVIEW_ROWS ? <p className="text-muted-foreground text-sm">{t('more', { count: preview.items.length - PREVIEW_ROWS })}</p> : null}
              {preview.counts.error > 0 ? (
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={includeErrors} onChange={(e) => setIncludeErrors(e.target.checked)} className="size-5" />
                  {t('includeErrors')}
                </label>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {result?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tAll(result.error)}
        </p>
      ) : null}

      {parsed ? (
        <Button size="lg" className="h-12 self-start" disabled={saving || needsCrs || rows.length === 0} onClick={save}>
          {saving ? t('saving') : t('save', { count: rows.length })}
        </Button>
      ) : null}
    </div>
  );
}
