import { area, bbox, booleanIntersects, distance, featureCollection, feature, intersect, union } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { DUPLICATE_IOU, DUPLICATE_POINT_METERS } from '@/lib/eudr/rules';
import { allPositions } from './coords';
import type { PlotGeometry } from './types';

type Areal = GeoJSON.Polygon | GeoJSON.MultiPolygon;

const isAreal = (g: PlotGeometry): g is Areal => g.type === 'Polygon' || g.type === 'MultiPolygon';

/** ~10 m in degrees, generous for the bbox pre-filter. */
const BBOX_PAD = 0.0002;

function bboxesTouch(a: PlotGeometry, b: PlotGeometry): boolean {
  const [a0, a1, a2, a3] = bbox(a);
  const [b0, b1, b2, b3] = bbox(b);
  return a0 - BBOX_PAD <= b2 && b0 - BBOX_PAD <= a2 && a1 - BBOX_PAD <= b3 && b1 - BBOX_PAD <= a3;
}

function iou(a: Areal, b: Areal): number {
  if (!booleanIntersects(a, b)) return 0;
  const pair = featureCollection([feature(a), feature(b)]);
  const inter = intersect(pair);
  const uni = union(pair);
  if (!inter || !uni) return 0;
  return area(inter) / area(uni);
}

function pointsClose(a: PlotGeometry, b: PlotGeometry): boolean {
  const pa = allPositions(a);
  const pb = allPositions(b);
  return pa.some((p) => pb.some((q) => distance(p, q, { units: 'meters' }) <= DUPLICATE_POINT_METERS));
}

/** Ids of plots that are (almost) the same as `candidate`. Points compare with points, polygons with polygons. */
export function findDuplicates(candidate: PlotGeometry, others: { id: string; geometry: PlotGeometry }[]): string[] {
  return others
    .filter((o) => isAreal(o.geometry) === isAreal(candidate) && bboxesTouch(candidate, o.geometry))
    .filter((o) =>
      isAreal(candidate) && isAreal(o.geometry) ? iou(candidate, o.geometry) >= DUPLICATE_IOU : pointsClose(candidate, o.geometry),
    )
    .map((o) => o.id);
}
