import { describe, expect, it } from 'vitest';
import { statusFromIssues } from '@/lib/geo/types';
import { ALLOWED_GEOMETRY_TYPES, EXPORT_MAX_BYTES } from '@/lib/eudr/rules';

describe('statusFromIssues', () => {
  it('is valid with no issues', () => {
    expect(statusFromIssues([])).toBe('valid');
  });
  it('is warning with one warning', () => {
    expect(statusFromIssues([{ code: 'POINT_AREA_MISSING', severity: 'warning' }])).toBe('warning');
  });
  it('is error when any error is present', () => {
    expect(
      statusFromIssues([
        { code: 'POINT_AREA_MISSING', severity: 'warning' },
        { code: 'POLYGON_SELF_INTERSECTION', severity: 'error' },
      ]),
    ).toBe('error');
  });
  it('ignores info issues', () => {
    expect(statusFromIssues([{ code: 'Z_COORDINATE_REMOVED', severity: 'info' }])).toBe('valid');
  });
});

describe('EUDR rules', () => {
  it('allows exactly the four EUDR geometry types', () => {
    expect([...ALLOWED_GEOMETRY_TYPES].sort()).toEqual(['MultiPoint', 'MultiPolygon', 'Point', 'Polygon']);
  });
  it('limits export to 25 MB', () => {
    expect(EXPORT_MAX_BYTES).toBe(26214400);
  });
});
