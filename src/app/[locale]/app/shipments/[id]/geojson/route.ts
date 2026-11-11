import { NextResponse } from 'next/server';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { getShipment } from '@/lib/shipments/queries';

/** GeoJSON for the EUDR Information System, built from the plot snapshots of the shipment. */
export async function GET(_req: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const data = await getShipment(current.organization.id, id, locale);
  if (!data) return new NextResponse(null, { status: 404 });
  const name = `${data.shipment.internal_ref.replace(/[^\w.\-]+/g, '_') || 'shipment'}.geojson`;
  return new NextResponse(data.geojson.text, {
    headers: {
      'content-type': 'application/geo+json; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}
