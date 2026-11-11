import { booleanClockwise, kinks, polygon as turfPolygon } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { ALLOWED_GEOMETRY_TYPES } from '@/lib/eudr/rules';
import { allPositions, mapPositions } from './coords';
import type { Issue, PlotGeometry } from './types';

type Ring = GeoJSON.Position[];

function isAllowed(g: GeoJSON.Geometry): g is PlotGeometry {
  return (ALLOWED_GEOMETRY_TYPES as readonly string[]).includes(g.type);
}

function samePos(a: GeoJSON.Position | undefined, b: GeoJSON.Position | undefined): boolean {
  return a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];
}

function dedupe(ring: Ring): Ring {
  return ring.filter((p, i) => i === 0 || !samePos(p, ring[i - 1]));
}

interface PolygonResult {
  rings: Ring[];
  issues: Issue[];
  closed: boolean;
  rewound: boolean;
}

function normalizePolygon(rings: Ring[], partIndex: number | undefined): PolygonResult {
  const issues: Issue[] = [];
  let closed = false;
  let rewound = false;
  const withPart = (i: Issue): Issue => (partIndex === undefined ? i : { ...i, partIndex });

  let out = rings.map((raw) => {
    const ring = dedupe(raw);
    if (ring.length > 0 && !samePos(ring[0], ring[ring.length - 1])) {
      closed = true;
      ring.push([...(ring[0] as GeoJSON.Position)]);
    }
    return ring;
  });

  if (out.some((r) => r.length < 4)) {
    issues.push(withPart({ code: 'POLYGON_TOO_FEW_POINTS', severity: 'error' }));
    return { rings: out, issues, closed, rewound };
  }

  // RFC 7946: exterior ring counter-clockwise, holes clockwise.
  out = out.map((ring, i) => {
    const wantClockwise = i > 0;
    if (booleanClockwise(ring) !== wantClockwise) {
      rewound = true;
      return [...ring].reverse();
    }
    return ring;
  });

  const k = kinks(turfPolygon(out));
  const first = k.features[0];
  if (first) {
    const [lon = 0, lat = 0] = first.geometry.coordinates;
    issues.push(
      withPart({
        code: 'POLYGON_SELF_INTERSECTION',
        severity: 'error',
        params: { lon: Math.round(lon * 1e6) / 1e6, lat: Math.round(lat * 1e6) / 1e6 },
      }),
    );
  }
  return { rings: out, issues, closed, rewound };
}

export function normalizeGeometry(input: GeoJSON.Geometry): { geometry: PlotGeometry | null; issues: Issue[] } {
  let geometry: GeoJSON.Geometry = input;
  if (geometry.type === 'GeometryCollection') {
    const allowed = geometry.geometries.filter(isAllowed);
    if (allowed.length !== 1 || geometry.geometries.length !== 1) {
      return { geometry: null, issues: [{ code: 'GEOM_TYPE_NOT_ALLOWED', severity: 'error', params: { type: 'GeometryCollection' } }] };
    }
    geometry = allowed[0] as PlotGeometry;
  }
  if (!isAllowed(geometry)) {
    return { geometry: null, issues: [{ code: 'GEOM_TYPE_NOT_ALLOWED', severity: 'error', params: { type: geometry.type } }] };
  }

  const issues: Issue[] = [];
  if (allPositions(geometry).some((p) => p.length > 2)) {
    issues.push({ code: 'Z_COORDINATE_REMOVED', severity: 'info' });
    geometry = mapPositions(geometry, (p) => [p[0] ?? 0, p[1] ?? 0]);
  }

  const polys: { rings: Ring[]; part: number | undefined }[] =
    geometry.type === 'Polygon'
      ? [{ rings: geometry.coordinates, part: undefined }]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.map((rings, part) => ({ rings, part }))
        : [];
  if (polys.length === 0) return { geometry, issues };

  const results = polys.map((p) => normalizePolygon(p.rings, p.part));
  if (results.some((r) => r.closed)) issues.push({ code: 'POLYGON_CLOSED_AUTOMATICALLY', severity: 'warning' });
  if (results.some((r) => r.rewound)) issues.push({ code: 'RING_ORIENTATION_FIXED', severity: 'info' });
  issues.push(...results.flatMap((r) => r.issues));

  const normalized: PlotGeometry =
    geometry.type === 'Polygon'
      ? { type: 'Polygon', coordinates: results[0]?.rings ?? [] }
      : { type: 'MultiPolygon', coordinates: results.map((r) => r.rings) };
  return { geometry: normalized, issues };
}
