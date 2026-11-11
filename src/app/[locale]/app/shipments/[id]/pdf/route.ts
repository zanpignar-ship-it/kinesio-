import { NextResponse } from 'next/server';
import { renderPackagePdf } from '@/components/share/package-pdf';
import { getCurrentMembership, getSessionUser } from '@/lib/auth/session';
import { pdfLabels } from '@/lib/share/labels';
import { ownerPackage } from '@/lib/share/owner-package';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const pkg = await ownerPackage(current, id, locale);
  if (!pkg) return new NextResponse(null, { status: 404 });
  const pdf = await renderPackagePdf(pkg, await pdfLabels(locale));
  const name = `${pkg.shipments[0]?.internal_ref.replace(/[^\w.\-]+/g, '_') ?? 'paket'}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
  });
}
