import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/redirect';
import { createServerSupabase } from '@/lib/supabase/server';

/** Links from Supabase e-mails (password reset, later confirmation and invitations) land here with a one-time code. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'), '/app');
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(`/${locale}${next}`, url.origin));
  }
  return NextResponse.redirect(new URL(`/${locale}/forgot-password?expired=1`, url.origin));
}
