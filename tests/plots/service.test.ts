import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { preparePlot } from '@/lib/plots/service';
import { toDbGeometry } from '@/lib/plots/to-db';
import { geometrySchema, plotFormSchema } from '@/lib/plots/schemas';
import { BOW_TIE, KOCEVJE_SQUARE } from '../geo/fixtures';

const LJ: GeoJSON.Point = { type: 'Point', coordinates: [14.505751, 46.049865] };

describe('toDbGeometry', () => {
  it('adds an EPSG:4326 crs member', () => {
    expect(toDbGeometry(LJ)).toEqual({ ...LJ, crs: { type: 'name', properties: { name: 'EPSG:4326' } } });
  });
});

describe('preparePlot', () => {
  it('stores a valid polygon with the computed area', () => {
    const row = preparePlot({ label: 'P1', country: 'SI', geometry: KOCEVJE_SQUARE }, []);
    expect(row.validation_status).toBe('valid');
    expect(row.area_source).toBe('computed');
    expect(row.area_ha).toBeGreaterThan(0.9);
    expect(row.geom).toMatchObject({ type: 'Polygon', crs: { properties: { name: 'EPSG:4326' } } });
    expect(row.validation_issues).toEqual([]);
  });
  it('stores a 3 ha point as a warning with the declared area', () => {
    const row = preparePlot({ label: 'T', country: 'SI', geometry: LJ, declaredAreaHa: 3 }, []);
    expect(row).toMatchObject({ validation_status: 'warning', area_ha: 3, area_source: 'declared' });
  });
  it('keeps the original geometry of an invalid polygon so it can be fixed later', () => {
    const row = preparePlot({ label: 'B', country: 'SI', geometry: BOW_TIE }, []);
    expect(row.validation_status).toBe('error');
    expect(row.validation_issues.map((i) => i.code)).toContain('POLYGON_SELF_INTERSECTION');
    expect(row.geom?.type).toBe('Polygon');
  });
  it('flags duplicates among nearby plots', () => {
    const row = preparePlot({ label: 'D', country: 'SI', geometry: KOCEVJE_SQUARE }, [{ id: 'x', geometry: KOCEVJE_SQUARE }]);
    expect(row.validation_issues.map((i) => i.code)).toContain('DUPLICATE_PLOT');
  });
  it('accepts a plot with only a postal address', () => {
    const row = preparePlot({ label: 'N', country: 'SI', geometry: null, postalAddress: 'Gozdna 1, Kočevje' }, []);
    expect(row).toMatchObject({ geom: null, postal_address: 'Gozdna 1, Kočevje', validation_status: 'warning' });
  });
  it('does not store swapped coordinates as a geometry', () => {
    const row = preparePlot({ label: 'S', country: 'SI', geometry: { type: 'Point', coordinates: [46.049865, 14.505751] } }, []);
    expect(row.validation_status).toBe('error');
    expect(row.geom).toBeNull();
  });
});

describe('schemas', () => {
  it('validates the plot form', () => {
    expect(plotFormSchema.safeParse({ label: 'P1', country: 'SI' }).success).toBe(true);
    expect(plotFormSchema.safeParse({ label: ' ', country: 'SI' }).error?.issues[0]?.message).toBe('plots.errors.label');
    expect(plotFormSchema.safeParse({ label: 'P', country: 'XX' }).error?.issues[0]?.message).toBe('plots.errors.country');
    expect(plotFormSchema.safeParse({ label: 'P', country: 'SI', declaredAreaHa: '2,5' }).data?.declaredAreaHa).toBe(2.5);
    expect(plotFormSchema.safeParse({ label: 'P', country: 'SI', declaredAreaHa: '' }).data?.declaredAreaHa).toBeUndefined();
  });
  it('accepts plot geometries and rejects lines', () => {
    expect(geometrySchema.safeParse(KOCEVJE_SQUARE).success).toBe(true);
    expect(geometrySchema.safeParse({ type: 'LineString', coordinates: [[1, 2], [3, 4]] }).success).toBe(false);
  });
});
