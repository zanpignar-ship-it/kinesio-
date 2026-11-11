import { NextResponse } from 'next/server';
import { renderPackagePdf } from '@/components/share/package-pdf';
import { pdfLabels } from '@/lib/share/labels';
import { packageForToken } from '@/lib/share/public';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const pkg = await packageForToken(token);
  if (!pkg) return new NextResponse(null, { status: 404 });
  const pdf = await renderPackagePdf(pkg, await pdfLabels(locale));
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="paket.pdf"', 'cache-control': 'no-store' },
  });
}
