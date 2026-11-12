import { NextResponse } from 'next/server';
import { buildEudrGeoJson, serializeEudrGeoJson } from '@/lib/geo/export-eudr';
import type { PlotGeometry } from '@/lib/geo/types';
import { packageForToken } from '@/lib/share/public';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pkg = await packageForToken(token);
  if (!pkg) return new NextResponse(null, { status: 404 });
  const plots = pkg.shipments.flatMap((s) =>
    s.plots.map((p) => ({ label: p.label, geometry: p.geometry as PlotGeometry, producerName: p.supplier ?? undefined, producerCountry: p.country, areaHa: p.area_ha })),
  );
  return new NextResponse(serializeEudrGeoJson(buildEudrGeoJson(plots)).text, {
    headers: { 'content-type': 'application/geo+json; charset=utf-8', 'content-disposition': 'attachment; filename="parcele.geojson"', 'cache-control': 'no-store' },
  });
}
