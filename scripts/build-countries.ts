/**
 * Extract simplified country borders from Natural Earth 1:10m (public domain).
 * Usage: npx tsx scripts/build-countries.ts
 */
import { writeFileSync } from 'node:fs';
import { simplify } from '@turf/turf';
import type * as GeoJSON from 'geojson';

const SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const KEEP = new Set(['SI', 'HR', 'BA', 'RS', 'AT', 'IT', 'HU', 'ME']);
const OUT = new URL('../src/lib/geo/data/countries.json', import.meta.url);

type CountryProps = { ISO_A2?: string; ISO_A2_EH?: string };

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const fc = (await res.json()) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, CountryProps>;

const features = fc.features
  .map((f) => ({ f, iso: f.properties.ISO_A2 && f.properties.ISO_A2 !== '-99' ? f.properties.ISO_A2 : f.properties.ISO_A2_EH }))
  .filter((x): x is { f: (typeof fc.features)[number]; iso: string } => typeof x.iso === 'string' && KEEP.has(x.iso))
  .map(({ f, iso }) => {
    const simple = simplify(f, { tolerance: 0.0005, highQuality: true });
    const round = (p: GeoJSON.Position): GeoJSON.Position => [Math.round((p[0] ?? 0) * 1e5) / 1e5, Math.round((p[1] ?? 0) * 1e5) / 1e5];
    const g = simple.geometry;
    const geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon =
      g.type === 'Polygon'
        ? { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(round)) }
        : { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map((r) => r.map(round))) };
    return { type: 'Feature' as const, properties: { iso }, geometry };
  });

const out = { type: 'FeatureCollection', source: 'Natural Earth 1:10m admin 0 (public domain)', features };
writeFileSync(OUT, JSON.stringify(out));
console.log(features.map((f) => f.properties.iso).sort().join(','), JSON.stringify(out).length, 'bytes');
