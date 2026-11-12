import { EXPORT_MAX_BYTES } from '@/lib/eudr/rules';
import type { PlotStatus } from '@/lib/geo/types';
import { needsRiskAssessment, type RiskLevel } from './risk';

export type ReadinessInput = {
  mode: 'submit_dds' | 'forward_references';
  activity: 'domestic' | 'import' | 'export';
  countryOfProduction: string | null;
  items: { product: string; hsCode: string; hsInScope: boolean; scientificName: string | null; netMassKg: number | null; volumeM3: number | null; pieces: number | null }[];
  plots: { label: string; status: PlotStatus; hasGeometry: boolean; documentCount: number; expiredDocuments: number; hasHarvestDate?: boolean }[];
  upstreamReferences: number;
  geojsonBytes: number;
  /** Polygons were simplified to fit the size limit (the export differs slightly from the stored outlines). */
  geojsonSimplified?: boolean;
  /** Risk of the country of production and the recorded assessment (EUDR art. 10, 11, 13). */
  risk?: { level: RiskLevel | null; assessed: boolean; negligible: boolean | null };
};

export type ReadinessKey =
  | 'itemsMissing'
  | 'hsOutOfScope'
  | 'speciesMissing'
  | 'netMassRequired'
  | 'quantityMissing'
  | 'plotsMissing'
  | 'referencesMissing'
  | 'countryMissing'
  | 'plotErrors'
  | 'plotNoGeometry'
  | 'geojsonTooLarge'
  | 'plotNoDocuments'
  | 'expiredDocuments'
  | 'plotNoHarvestDate'
  | 'geojsonSimplified'
  | 'riskAssessmentMissing'
  | 'riskNotNegligible'
  | 'highRiskCountry';

export type ReadinessIssue = { key: ReadinessKey; level: 'error' | 'warning'; params?: Record<string, string | number> };

const names = (xs: { label?: string; product?: string }[]) =>
  xs
    .map((x) => x.label ?? x.product ?? '')
    .slice(0, 5)
    .join(', ');

/** What still blocks marking a shipment as ready (errors) and what deserves a look (warnings). */
export function checkReadiness(input: ReadinessInput): { ready: boolean; issues: ReadinessIssue[] } {
  const issues: ReadinessIssue[] = [];
  const err = (key: ReadinessKey, params?: ReadinessIssue['params']) => issues.push(params ? { key, level: 'error', params } : { key, level: 'error' });
  const warn = (key: ReadinessKey, params?: ReadinessIssue['params']) => issues.push(params ? { key, level: 'warning', params } : { key, level: 'warning' });

  if (input.items.length === 0) err('itemsMissing');
  const outOfScope = input.items.filter((i) => !i.hsInScope);
  if (outOfScope.length) err('hsOutOfScope', { codes: outOfScope.map((i) => i.hsCode).join(', ') });
  const noSpecies = input.items.filter((i) => !i.scientificName);
  if (noSpecies.length) err('speciesMissing', { products: names(noSpecies) });
  const crossBorder = input.activity !== 'domestic';
  const noMass = input.items.filter((i) => crossBorder && !i.netMassKg);
  if (noMass.length) err('netMassRequired', { products: names(noMass) });
  const noQuantity = input.items.filter((i) => !crossBorder && !i.netMassKg && !i.volumeM3 && !i.pieces);
  if (noQuantity.length) err('quantityMissing', { products: names(noQuantity) });

  if (input.mode === 'submit_dds') {
    if (input.plots.length === 0) err('plotsMissing');
    if (!input.countryOfProduction) err('countryMissing');
  } else if (input.upstreamReferences === 0) {
    err('referencesMissing');
  }

  const withErrors = input.plots.filter((p) => p.status === 'error');
  if (withErrors.length) err('plotErrors', { plots: names(withErrors) });
  const noGeometry = input.plots.filter((p) => !p.hasGeometry);
  if (noGeometry.length) err('plotNoGeometry', { plots: names(noGeometry) });
  if (input.geojsonBytes > EXPORT_MAX_BYTES) err('geojsonTooLarge');
  if (input.geojsonSimplified) warn('geojsonSimplified');

  if (input.mode === 'submit_dds' && input.risk && needsRiskAssessment(input.risk.level)) {
    if (!input.risk.assessed) err('riskAssessmentMissing');
    else if (input.risk.negligible !== true) err('riskNotNegligible');
    if (input.risk.level === 'high') warn('highRiskCountry');
  }

  const noDocs = input.plots.filter((p) => p.documentCount === 0);
  if (noDocs.length) warn('plotNoDocuments', { plots: names(noDocs) });
  const expired = input.plots.reduce((n, p) => n + p.expiredDocuments, 0);
  if (expired) warn('expiredDocuments', { count: expired });
  // EUDR art. 9(1)(d): date or time range of production. TODO: preveri, ali je polje obvezno v obrazcu DDS.
  const noHarvest = input.plots.filter((p) => p.hasHarvestDate === false);
  if (noHarvest.length) warn('plotNoHarvestDate', { plots: names(noHarvest) });

  return { ready: !issues.some((i) => i.level === 'error'), issues };
}
