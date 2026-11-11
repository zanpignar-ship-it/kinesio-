import { describe, expect, it } from 'vitest';
import { nextCopyRef } from '@/lib/shipments/next-ref';
import { checkReadiness, type ReadinessInput } from '@/lib/shipments/readiness';
import { ddsSummary } from '@/lib/shipments/dds-summary';

const base: ReadinessInput = {
  mode: 'submit_dds',
  activity: 'export',
  countryOfProduction: 'SI',
  items: [{ product: 'Hlodovina smreka', hsCode: '4403', hsInScope: true, scientificName: 'Picea abies', netMassKg: 24000, volumeM3: null, pieces: null }],
  plots: [{ label: 'P1', status: 'valid', hasGeometry: true, documentCount: 1, expiredDocuments: 0 }],
  upstreamReferences: 0,
  geojsonBytes: 1000,
};
const keys = (i: ReadinessInput) => checkReadiness(i).issues.map((x) => `${x.level}:${x.key}`);

describe('checkReadiness', () => {
  it('is ready for a complete shipment', () => {
    expect(checkReadiness(base)).toEqual({ ready: true, issues: [] });
  });
  it('needs at least one product and plot', () => {
    expect(keys({ ...base, items: [], plots: [] })).toEqual(['error:itemsMissing', 'error:plotsMissing']);
  });
  it('requires net mass for import/export and any quantity otherwise', () => {
    const noMass = { ...base.items[0]!, netMassKg: null, volumeM3: 30 };
    expect(keys({ ...base, items: [noMass] })).toEqual(['error:netMassRequired']);
    expect(checkReadiness({ ...base, activity: 'domestic', items: [noMass] }).ready).toBe(true);
    expect(keys({ ...base, activity: 'domestic', items: [{ ...noMass, volumeM3: null }] })).toEqual(['error:quantityMissing']);
  });
  it('flags HS codes outside EUDR and missing species', () => {
    expect(keys({ ...base, items: [{ ...base.items[0]!, hsInScope: false, scientificName: null }] })).toEqual(['error:hsOutOfScope', 'error:speciesMissing']);
  });
  it('blocks plots with errors or without geometry, warns about documents', () => {
    const r = checkReadiness({
      ...base,
      plots: [
        { label: 'A', status: 'error', hasGeometry: true, documentCount: 0, expiredDocuments: 0 },
        { label: 'B', status: 'warning', hasGeometry: false, documentCount: 2, expiredDocuments: 1 },
      ],
    });
    expect(r.ready).toBe(false);
    expect(r.issues.map((i) => `${i.level}:${i.key}`)).toEqual(['error:plotErrors', 'error:plotNoGeometry', 'warning:plotNoDocuments', 'warning:expiredDocuments']);
    expect(r.issues[0]!.params).toEqual({ plots: 'A' });
  });
  it('blocks a GeoJSON over 25 MB and a missing country of production', () => {
    expect(keys({ ...base, geojsonBytes: 30 * 1024 * 1024, countryOfProduction: null })).toEqual(['error:countryMissing', 'error:geojsonTooLarge']);
  });
  it('forward mode needs supplier references, not plots', () => {
    expect(keys({ ...base, mode: 'forward_references', plots: [] })).toEqual(['error:referencesMissing']);
    expect(checkReadiness({ ...base, mode: 'forward_references', plots: [], upstreamReferences: 1 }).ready).toBe(true);
  });
});

describe('nextCopyRef', () => {
  it('adds -2 and counts up past existing references', () => {
    expect(nextCopyRef('S-12', [])).toBe('S-12-2');
    expect(nextCopyRef('S-12', ['S-12-2', 'S-12-3'])).toBe('S-12-4');
    expect(nextCopyRef('S-12-2', ['S-12-2'])).toBe('S-12-3');
  });
});

describe('ddsSummary', () => {
  it('lists the statement fields in TRACES order', () => {
    const s = ddsSummary({
      activity: 'export',
      operator: { name: 'Žaga d.o.o.', country: 'SI', eori: 'SI12345678', taxId: null },
      internalRef: 'S-1',
      countryOfProduction: 'SI',
      plotCount: 3,
      items: [{ hsCode: '4403', description: 'Hlodovina smreka', tradeName: null, scientificName: 'Picea abies', commonName: 'navadna smreka', netMassKg: 24000, volumeM3: null, pieces: null }],
      references: [{ kind: 'dds', referenceNo: '26SI0001', verificationNo: 'ABC' }],
    });
    expect(s.map((f) => f.key)).toEqual([
      'activity', 'operatorName', 'operatorCountry', 'operatorId', 'internalRef',
      'hsCode', 'description', 'scientificName', 'commonName', 'netMassKg',
      'countryOfProduction', 'geolocation', 'references',
    ]);
    expect(s.find((f) => f.key === 'netMassKg')?.value).toBe('24000');
    expect(s.find((f) => f.key === 'references')?.value).toBe('26SI0001 / ABC');
  });
});
