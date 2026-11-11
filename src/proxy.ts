import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { applySessionCookies, refreshSession } from './lib/supabase/proxy';

const intl = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // Refresh the session first so the locale response is built from the request with the new cookies.
  const cookies = await refreshSession(request);
  return applySessionCookies(intl(request), cookies);
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api/|_next/|_vercel/|.*\\..*).*)',
};
