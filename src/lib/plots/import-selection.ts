import type * as GeoJSON from 'geojson';
import type { DecimalStats, Issue, ParsedFeature, PlotGeometry, PlotStatus } from '@/lib/geo/types';
import { validatePlot } from '@/lib/geo/validate';

const LABEL_KEYS = ['name', 'Name', 'NAME', 'ime', 'IME', 'label', 'oznaka', 'OZNAKA', 'naziv', 'ProductionPlace'];
const AREA_KEYS = ['areaHa', 'Area', 'area', 'AREA', 'povrsina', 'površina', 'ha'];

export type ImportItem = {
  index: number;
  label: string;
  geometry: GeoJSON.Geometry | null;
  declaredAreaHa?: number;
  decimals: DecimalStats | null;
  status: PlotStatus;
  issues: Issue[];
  areaHa: number | null;
  normalized: PlotGeometry | null;
};

function pick(props: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = props[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/** Validate every feature of an import in the browser (preview); duplicates are checked within the file. */
export function previewImport(features: ParsedFeature[], country: string, fallbackLabel: string) {
  const counts: Record<PlotStatus, number> = { valid: 0, warning: 0, error: 0 };
  const seen: { id: string; geometry: PlotGeometry }[] = [];
  const items: ImportItem[] = features.map((feature, index) => {
    const rawLabel = pick(feature.properties, LABEL_KEYS);
    const rawArea = pick(feature.properties, AREA_KEYS);
    const area = rawArea === undefined ? undefined : Number(String(rawArea).replace(',', '.'));
    const declaredAreaHa = area !== undefined && Number.isFinite(area) && area >= 0 ? area : undefined;
    const result = validatePlot({ geometry: feature.geometry, country, declaredAreaHa, decimals: feature.decimals, others: seen });
    if (result.geometry) seen.push({ id: String(rawLabel ?? index + 1), geometry: result.geometry });
    counts[result.status] += 1;
    return {
      index,
      label: rawLabel === undefined ? `${fallbackLabel} ${index + 1}` : String(rawLabel).trim().slice(0, 120),
      geometry: feature.geometry,
      declaredAreaHa,
      decimals: feature.decimals,
      status: result.status,
      issues: result.issues,
      areaHa: result.areaHa,
      normalized: result.geometry,
    };
  });
  return { items, counts };
}

/** Rows sent to the server (which validates again); plots with errors only when the user asks. */
export function selectImportRows(items: ImportItem[], includeErrors: boolean) {
  return items
    .filter((i) => includeErrors || i.status !== 'error')
    .map((i) => ({ label: i.label, geometry: i.geometry, declaredAreaHa: i.declaredAreaHa, decimals: i.decimals }));
}
