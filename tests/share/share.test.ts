import { describe, expect, it } from 'vitest';
import { createShareToken, hashShareToken } from '@/lib/share/token';
import { plotsToSvg } from '@/lib/share/svg-map';

describe('share token', () => {
  it('is long, random and hashed with SHA-256', () => {
    const a = createShareToken();
    const b = createShareToken();
    expect(a.token).toHaveLength(43);
    expect(a.token).not.toBe(b.token);
    expect(a.hashHex).toMatch(/^[0-9a-f]{64}$/);
    expect(hashShareToken(a.token)).toBe(a.hashHex);
  });
});

describe('plotsToSvg', () => {
  it('fits polygons and points into the box, north up', () => {
    const svg = plotsToSvg(
      [
        { type: 'Polygon', coordinates: [[[14, 46], [14.01, 46], [14.01, 46.01], [14, 46.01], [14, 46]]] },
        { type: 'Point', coordinates: [14.02, 46.02] },
      ],
      200,
      100,
    );
    expect(svg.paths).toHaveLength(1);
    expect(svg.points).toHaveLength(1);
    for (const [x, y] of svg.points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
    // the point is north-east of the polygon: right and up (smaller y)
    const firstX = Number(svg.paths[0]!.split(/[ ,ML]+/).filter(Boolean)[0]);
    expect(svg.points[0]![0]).toBeGreaterThan(firstX);
  });
  it('handles an empty list', () => expect(plotsToSvg([], 100, 100)).toEqual({ paths: [], points: [] }));
});
