import { destination, transformTranslate } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import { findDuplicates } from '@/lib/geo/duplicates';
import { KOCEVJE_SQUARE } from './fixtures';

const shifted = (meters: number, bearing: number): GeoJSON.Polygon =>
  transformTranslate(KOCEVJE_SQUARE, meters, bearing, { units: 'meters' });
const pointAt = (meters: number): GeoJSON.Point => ({
  type: 'Point',
  coordinates: destination([14.505751, 46.049865], meters, 90, { units: 'meters' }).geometry.coordinates,
});

describe('findDuplicates', () => {
  it('finds the same polygon shifted by 1 m', () => {
    expect(findDuplicates(KOCEVJE_SQUARE, [{ id: 'a', geometry: shifted(1, 45) }])).toEqual(['a']);
  });
  it('ignores a neighbouring polygon', () => {
    expect(findDuplicates(KOCEVJE_SQUARE, [{ id: 'b', geometry: shifted(150, 90) }])).toEqual([]);
  });
  it('ignores a polygon that only half overlaps', () => {
    expect(findDuplicates(KOCEVJE_SQUARE, [{ id: 'c', geometry: shifted(50, 90) }])).toEqual([]);
  });
  it('finds points 3 m apart', () => {
    expect(findDuplicates(pointAt(0), [{ id: 'p', geometry: pointAt(3) }])).toEqual(['p']);
  });
  it('ignores points 20 m apart', () => {
    expect(findDuplicates(pointAt(0), [{ id: 'q', geometry: pointAt(20) }])).toEqual([]);
  });
  it('does not compare a point with a polygon', () => {
    expect(findDuplicates(pointAt(0), [{ id: 'r', geometry: KOCEVJE_SQUARE }])).toEqual([]);
  });
});
