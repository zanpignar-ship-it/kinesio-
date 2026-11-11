import type * as GeoJSON from 'geojson';
import type { DecimalStats, Issue, PlotGeometry, PlotStatus } from '@/lib/geo/types';
import { validatePlot } from '@/lib/geo/validate';
import { toDbGeometry, type DbGeometry } from './to-db';

export interface PlotInput {
  label: string;
  country: string;
  geometry: GeoJSON.Geometry | null;
  declaredAreaHa?: number;
  cadastralNo?: string;
  cadastralMunicipality?: string;
  postalAddress?: string;
  /** Decimals measured on the source file (imports); undefined = measure from numbers. */
  decimals?: DecimalStats | null;
}

export interface PreparedPlot {
  label: string;
  country: string;
  geom: DbGeometry | null;
  area_ha: number | null;
  area_source: 'computed' | 'declared' | null;
  validation_status: PlotStatus;
  validation_issues: Issue[];
  cadastral_no: string | null;
  cadastral_municipality: string | null;
  postal_address: string | null;
}

/** Validate a plot (server side, authoritative) and turn it into the columns stored in `plots`. */
export function preparePlot(input: PlotInput, others: { id: string; geometry: PlotGeometry }[]): PreparedPlot {
  const result = validatePlot({
    geometry: input.geometry,
    country: input.country,
    declaredAreaHa: input.declaredAreaHa,
    decimals: input.decimals,
    others,
  });
  const isPoint = result.geometry?.type === 'Point' || result.geometry?.type === 'MultiPoint';
  return {
    label: input.label,
    country: input.country,
    geom: result.geometry ? toDbGeometry(result.geometry) : null,
    area_ha: result.areaHa,
    area_source: result.areaHa === null ? null : isPoint ? 'declared' : 'computed',
    validation_status: result.status,
    validation_issues: result.issues,
    cadastral_no: input.cadastralNo ?? null,
    cadastral_municipality: input.cadastralMunicipality ?? null,
    postal_address: input.postalAddress ?? null,
  };
}
