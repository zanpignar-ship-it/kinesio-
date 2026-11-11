import type * as GeoJSON from 'geojson';
import { allPositions } from '@/lib/geo/coords';

/**
 * Simple equirectangular projection of plots into a width × height box (north up, with a 5 % margin),
 * for the plot map in the buyer package PDF.
 */
export function plotsToSvg(geometries: GeoJSON.Geometry[], width: number, height: number): { paths: string[]; points: [number, number][] } {
  const all = geometries.flatMap(allPositions);
  if (all.length === 0) return { paths: [], points: [] };
  const lons = all.map((p) => p[0] ?? 0);
  const lats = all.map((p) => p[1] ?? 0);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((width * 0.9) / spanX, (height * 0.9) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const project = (p: GeoJSON.Position): [number, number] => [
    Math.round((offX + ((p[0] ?? 0) - minLon) * k * scale) * 10) / 10,
    Math.round((offY + (maxLat - (p[1] ?? 0)) * scale) * 10) / 10,
  ];
  const paths: string[] = [];
  const points: [number, number][] = [];
  const ring = (r: GeoJSON.Position[]) => r.map((p, i) => `${i === 0 ? 'M' : 'L'}${project(p).join(',')}`).join(' ') + ' Z';
  for (const g of geometries) {
    if (g.type === 'Polygon') paths.push(g.coordinates.map(ring).join(' '));
    else if (g.type === 'MultiPolygon') paths.push(g.coordinates.map((poly) => poly.map(ring).join(' ')).join(' '));
    else if (g.type === 'Point') points.push(project(g.coordinates));
    else if (g.type === 'MultiPoint') points.push(...g.coordinates.map(project));
  }
  return { paths, points };
}
