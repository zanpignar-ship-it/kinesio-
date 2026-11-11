import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/db/database.types';
import { supabaseEnv } from './env';

/**
 * Refresh the Supabase auth session on every request and copy refreshed cookies onto `response`
 * (the response next-intl produced). Must run before any Server Component reads the session.
 */
export async function updateSession(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const { url, publishableKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  // getClaims() validates the JWT; do not use getSession() on the server.
  await supabase.auth.getClaims();
  return response;
}
