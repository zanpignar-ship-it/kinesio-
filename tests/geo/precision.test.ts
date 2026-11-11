import { describe, expect, it } from 'vitest';
import { checkCoordinateRanges, checkPrecision, countDecimals, decimalStatsFromNumbers } from '@/lib/geo/precision';

describe('countDecimals', () => {
  it('counts digits after a decimal comma', () => expect(countDecimals('46,1234567')).toBe(7));
  it('counts digits after a dot', () => expect(countDecimals('14.5')).toBe(1));
  it('returns 0 for integers', () => expect(countDecimals(14)).toBe(0));
  it('handles exponent notation', () => expect(countDecimals(1e-7)).toBe(7));
  it('handles string exponent', () => expect(countDecimals('1.5e-3')).toBe(4));
});

describe('decimalStatsFromNumbers', () => {
  it('returns min/max decimals over all coordinates', () => {
    expect(
      decimalStatsFromNumbers({
        type: 'Polygon',
        coordinates: [[[14.1, 45.123456], [14.12345678, 45.2], [14.3, 45.3], [14.1, 45.123456]]],
      }),
    ).toEqual({ min: 1, max: 8 });
  });
});

describe('checkPrecision', () => {
  it('errors when every coordinate has fewer than 6 decimals', () => {
    const issues = checkPrecision({ min: 4, max: 5 });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('PRECISION_TOO_LOW');
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.params?.found).toBe(5);
    expect(issues[0]?.params?.required).toBe(6);
  });
  it('only warns when some coordinates lost trailing zeros', () => {
    const issues = checkPrecision({ min: 5, max: 6 });
    expect(issues.map((i) => [i.code, i.severity])).toEqual([['PRECISION_PARTIAL', 'warning']]);
  });
  it('accepts 6+ decimals', () => expect(checkPrecision({ min: 6, max: 8 })).toEqual([]));
  it('skips when unknown', () => expect(checkPrecision(null)).toEqual([]));
});

describe('checkCoordinateRanges', () => {
  it('detects swapped lat/lon for Slovenia', () => {
    const issues = checkCoordinateRanges({ type: 'Point', coordinates: [46.05, 14.5] }, 'SI');
    expect(issues.map((i) => i.code)).toEqual(['COORD_SWAPPED']);
  });
  it('detects projected metres', () => {
    const issues = checkCoordinateRanges({ type: 'Point', coordinates: [462000, 101000] }, 'SI');
    expect(issues.map((i) => i.code)).toEqual(['COORD_LOOKS_PROJECTED']);
  });
  it('detects out-of-range degrees', () => {
    const issues = checkCoordinateRanges({ type: 'Point', coordinates: [200, 46] }, 'SI');
    expect(issues.map((i) => i.code)).toEqual(['COORD_OUT_OF_RANGE']);
  });
  it('accepts a valid point in Ljubljana', () => {
    expect(checkCoordinateRanges({ type: 'Point', coordinates: [14.505751, 46.049865] }, 'SI')).toEqual([]);
  });
});
