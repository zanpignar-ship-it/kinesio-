'use client';

import { useState, useTransition } from 'react';
import Papa from 'papaparse';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { importRecords, type ImportRecordsResult } from '@/app/[locale]/app/master-data/actions';
import { mapImportRows, type ImportEntity, type ImportResult } from '@/lib/masterdata/import';
import { readXlsxRows } from '@/lib/geo/parse/xlsx';

/** Customers or suppliers from a CSV or Excel file: preview, then save. */
export function ImportRecords({ entity, defaultCountry }: { entity: ImportEntity; defaultCountry: string }) {
  const t = useTranslations('md');
  const tAll = useTranslations();
  const locale = useLocale();
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportRecordsResult | null>(null);
  const [saving, start] = useTransition();

  const read = async (file: File) => {
    setResult(null);
    const data = new Uint8Array(await file.arrayBuffer());
    let rows: string[][];
    try {
      if (/\.xlsx$/i.test(file.name)) rows = await readXlsxRows(data);
      else {
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(data);
        } catch {
          text = new TextDecoder('windows-1250').decode(data);
        }
        rows = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t'] }).data;
      }
    } catch {
      setPreview({ records: [], errors: [{ row: 1, message: 'md.import.unreadable' }] });
      return;
    }
    setPreview(mapImportRows(entity, rows, defaultCountry));
  };

  return (
    <details className="rounded-xl border p-4" data-testid="import-records">
      <summary className="cursor-pointer font-medium">{t('import.title')}</summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">{t(`import.hint.${entity}`)}</p>
        <input type="file" accept=".csv,.txt,.xlsx" aria-label={t('import.file')} onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
        {preview ? (
          <>
            <p>{t('import.found', { count: preview.records.length })}</p>
            {preview.errors.length ? (
              <ul className="text-destructive list-disc pl-5 text-xs">
                {preview.errors.slice(0, 20).map((e) => (
                  <li key={e.row}>{t('import.rowError', { row: e.row, message: tAll(e.message) })}</li>
                ))}
              </ul>
            ) : null}
            {preview.records.length ? (
              <Button
                type="button"
                className="self-start"
                disabled={saving}
                onClick={() => start(async () => setResult(await importRecords(entity, preview.records, locale)))}
              >
                {t('import.save', { count: preview.records.length })}
              </Button>
            ) : null}
          </>
        ) : null}
        {result?.inserted !== undefined && !result.error ? (
          <p role="status" className="text-green-700 dark:text-green-400">
            {t('import.done', { inserted: result.inserted, skipped: result.skipped ?? 0 })}
          </p>
        ) : null}
        {result?.error ? (
          <p role="alert" className="text-destructive">
            {tAll(result.error)}
          </p>
        ) : null}
      </div>
    </details>
  );
}
