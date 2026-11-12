import { describe, expect, it } from 'vitest';
import { plotFormSchema } from '@/lib/plots/schemas';
import { productionPeriod } from '@/lib/shipments/dds-summary';
import { checkReadiness, type ReadinessInput } from '@/lib/shipments/readiness';

describe('harvest period', () => {
  it('plot form: optional dates in order', () => {
    expect(plotFormSchema.parse({ label: 'P', country: 'SI', harvestFrom: '', harvestTo: '' }).harvestFrom).toBeUndefined();
    expect(plotFormSchema.safeParse({ label: 'P', country: 'SI', harvestFrom: '2026-02-01', harvestTo: '2026-03-01' }).success).toBe(true);
    expect(plotFormSchema.safeParse({ label: 'P', country: 'SI', harvestFrom: '2026-03-01', harvestTo: '2026-02-01' }).error?.issues[0]?.message).toBe('plots.errors.harvest');
  });

  it('production period spans all plots', () => {
    expect(productionPeriod([])).toBeNull();
    expect(productionPeriod([{ harvestFrom: null, harvestTo: null }])).toBeNull();
    expect(productionPeriod([{ harvestFrom: '2026-01-10', harvestTo: null }])).toBe('2026-01-10');
    expect(
      productionPeriod([
        { harvestFrom: '2026-02-01', harvestTo: '2026-02-20' },
        { harvestFrom: '2026-01-10', harvestTo: '2026-01-15' },
        { harvestFrom: null, harvestTo: '2026-03-31' },
      ]),
    ).toBe('2026-01-10 – 2026-03-31');
  });

  it('readiness warns about plots without a harvest date', () => {
    const base: ReadinessInput = {
      mode: 'submit_dds',
      activity: 'export',
      countryOfProduction: 'SI',
      items: [{ product: 'Hlodi', hsCode: '4403', hsInScope: true, scientificName: 'Picea abies', netMassKg: 1, volumeM3: null, pieces: null }],
      plots: [{ label: 'A', status: 'valid', hasGeometry: true, documentCount: 1, expiredDocuments: 0, hasHarvestDate: false }],
      upstreamReferences: 0,
      geojsonBytes: 100,
    };
    const r = checkReadiness(base);
    expect(r.ready).toBe(true);
    expect(r.issues).toEqual([{ key: 'plotNoHarvestDate', level: 'warning', params: { plots: 'A' } }]);
  });
});
