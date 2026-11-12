import { describe, expect, it } from 'vitest';
import { checkReadiness, type ReadinessInput } from '@/lib/shipments/readiness';
import { countryRisk, needsRiskAssessment } from '@/lib/shipments/risk';

const listed = [
  { country: 'SI', risk: 'low' as const },
  { country: 'RU', risk: 'high' as const },
];

describe('country risk', () => {
  it('uses the list and treats unlisted countries as standard risk', () => {
    expect(countryRisk('SI', listed)).toBe('low');
    expect(countryRisk('RU', listed)).toBe('high');
    expect(countryRisk('UA', listed)).toBe('standard');
    expect(countryRisk(null, listed)).toBeNull();
    expect(needsRiskAssessment('low')).toBe(false);
    expect(needsRiskAssessment('standard')).toBe(true);
  });
});

describe('readiness with risk', () => {
  const base: ReadinessInput = {
    mode: 'submit_dds',
    activity: 'import',
    countryOfProduction: 'UA',
    items: [{ product: 'Hlodi', hsCode: '4403', hsInScope: true, scientificName: 'Quercus robur', netMassKg: 1, volumeM3: null, pieces: null }],
    plots: [{ label: 'A', status: 'valid', hasGeometry: true, documentCount: 1, expiredDocuments: 0 }],
    upstreamReferences: 0,
    geojsonBytes: 100,
  };
  const keys = (i: ReadinessInput) => checkReadiness(i).issues.map((x) => `${x.level}:${x.key}`);

  it('standard risk needs an assessment concluding negligible risk', () => {
    expect(keys({ ...base, risk: { level: 'standard', assessed: false, negligible: null } })).toEqual(['error:riskAssessmentMissing']);
    expect(keys({ ...base, risk: { level: 'standard', assessed: true, negligible: false } })).toEqual(['error:riskNotNegligible']);
    expect(checkReadiness({ ...base, risk: { level: 'standard', assessed: true, negligible: true } }).ready).toBe(true);
  });
  it('high risk also warns; low risk needs nothing', () => {
    expect(keys({ ...base, risk: { level: 'high', assessed: true, negligible: true } })).toEqual(['warning:highRiskCountry']);
    expect(keys({ ...base, risk: { level: 'low', assessed: false, negligible: null } })).toEqual([]);
  });
  it('forwarding references does not need an own assessment', () => {
    expect(keys({ ...base, mode: 'forward_references', upstreamReferences: 1, risk: { level: 'standard', assessed: false, negligible: null } })).toEqual([]);
  });
});

import { shipmentRisk } from '@/lib/shipments/risk';

describe('risk across all countries', () => {
  it('takes the highest risk of the shipment and its plots', () => {
    expect(shipmentRisk(['SI', 'SI'], listed)).toBe('low');
    expect(shipmentRisk(['SI', 'UA'], listed)).toBe('standard');
    expect(shipmentRisk(['UA', 'RU', null], listed)).toBe('high');
    expect(shipmentRisk([null], listed)).toBeNull();
  });
  it('a recorded non-negligible risk blocks even a low-risk shipment', () => {
    const r = checkReadiness({
      mode: 'submit_dds', activity: 'domestic', countryOfProduction: 'SI',
      items: [{ product: 'H', hsCode: '4403', hsInScope: true, scientificName: 'Picea abies', netMassKg: 1, volumeM3: null, pieces: null }],
      plots: [{ label: 'A', status: 'valid', hasGeometry: true, documentCount: 1, expiredDocuments: 0 }],
      upstreamReferences: 0, geojsonBytes: 1,
      risk: { level: 'low', assessed: true, negligible: false },
    });
    expect(r.issues.map((i) => i.key)).toEqual(['riskNotNegligible']);
  });
});
