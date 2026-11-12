import { NextResponse } from 'next/server';
import { toCsv } from '@/lib/archive/csv';
import { plotRows } from '@/lib/archive/lists';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';

/** CSV for Excel (semicolon, UTF-8 with BOM). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { current } = await getCurrentMembership(user.id);
  if (!current) return new NextResponse(null, { status: 404 });
  const rows = await plotRows(current.organization.id);
  const columns = rows[0] ? Object.keys(rows[0]) : ['id'];
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows, columns), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="lestrace-plots-${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
