import { NextResponse } from 'next/server';
import { buildArchive } from '@/lib/archive/build';
import { collectArchive } from '@/lib/archive/collect';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';

export const maxDuration = 300;

/** ZIP with all plots, tables, documents and import files of the current organization (EUDR: keep 5 years). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { current } = await getCurrentMembership(user.id);
  if (!current) return new NextResponse(null, { status: 404 });
  const input = await collectArchive(current.organization.id, current.organization.name);
  const zip = await buildArchive(input);
  const date = input.generatedAt.slice(0, 10);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="lestrace-archive-${date}.zip"`,
      'cache-control': 'no-store',
    },
  });
}
