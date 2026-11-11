import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/db/database.types';
import { supabaseEnv } from './env';

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] };

/**
 * Refresh the Supabase auth session. Refreshed cookies are written into `request` (so whatever builds the
 * response next – next-intl – forwards them to Server Components) and returned so they can be set on the response.
 */
export async function refreshSession(request: NextRequest): Promise<CookieToSet[]> {
  const { url, publishableKey } = supabaseEnv();
  let refreshed: CookieToSet[] = [];
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        refreshed = toSet;
      },
    },
  });
  // getClaims() validates the JWT; do not use getSession() on the server.
  await supabase.auth.getClaims();
  return refreshed;
}

export function applySessionCookies(response: NextResponse, cookies: CookieToSet[]): NextResponse {
  for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
  return response;
}
