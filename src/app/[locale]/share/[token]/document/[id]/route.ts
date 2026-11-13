import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Document of a shared shipment: the database checks the token and grants this one file; we redirect to a 5-minute signed URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!UUID.test(id) || !/^[\w-]{8,100}$/.test(token)) return new NextResponse(null, { status: 404 });
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('buyer_document_access', { p_token: token, p_document_id: id });
  const doc = data as unknown as { path: string } | null;
  if (!doc?.path) return new NextResponse(null, { status: 404 });
  const { data: signed } = await supabase.storage.from('documents').createSignedUrl(doc.path, 300);
  if (!signed?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { 'cache-control': 'no-store' } });
}
