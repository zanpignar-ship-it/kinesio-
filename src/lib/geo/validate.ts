import type * as GeoJSON from 'geojson';
import { checkArea, computeAreaHa } from './area';
import { checkCountry } from './country';
import { findDuplicates } from './duplicates';
import { normalizeGeometry } from './normalize';
import { checkCoordinateRanges, checkPrecision, decimalStatsFromNumbers } from './precision';
import { statusFromIssues, type DecimalStats, type Issue, type PlotGeometry, type ValidationResult } from './types';

export interface ValidatePlotInput {
  geometry: GeoJSON.Geometry | null;
  /** ISO 3166-1 alpha-2 of the declared country of production. */
  country: string;
  declaredAreaHa?: number;
  /**
   * Decimal stats measured on the source text. `undefined` → measured from the numbers;
   * `null` → unknown (e.g. reprojected data), precision check skipped.
   */
  decimals?: DecimalStats | null;
  others?: { id: string; geometry: PlotGeometry }[];
}

export function validatePlot(input: ValidatePlotInput): ValidationResult {
  if (!input.geometry) {
    const issues: Issue[] = [{ code: 'NO_GEOMETRY', severity: 'warning' }];
    return { status: statusFromIssues(issues), issues, geometry: null, areaHa: null };
  }
  const rangeIssues = checkCoordinateRanges(input.geometry, input.country);
  if (rangeIssues.length > 0) return { status: statusFromIssues(rangeIssues), issues: rangeIssues, geometry: null, areaHa: null };

  const normalized = normalizeGeometry(input.geometry);
  const issues = [...normalized.issues];
  const geometry = normalized.geometry;
  if (!geometry) return { status: statusFromIssues(issues), issues, geometry: null, areaHa: null };

  const decimals = input.decimals === undefined ? decimalStatsFromNumbers(input.geometry) : input.decimals;
  issues.push(...checkPrecision(decimals));
  const structurallyBroken = issues.some((i) => i.code === 'POLYGON_TOO_FEW_POINTS');
  if (!structurallyBroken) {
    issues.push(...checkArea(geometry, input.declaredAreaHa));
    issues.push(...checkCountry(geometry, input.country));
    const dups = findDuplicates(geometry, input.others ?? []);
    if (dups.length > 0) issues.push({ code: 'DUPLICATE_PLOT', severity: 'warning', params: { ids: dups.join(',') } });
  }
  const computed = structurallyBroken ? null : computeAreaHa(geometry);
  const areaHa = computed ?? input.declaredAreaHa ?? null;
  return { status: statusFromIssues(issues), issues, geometry, areaHa };
}
