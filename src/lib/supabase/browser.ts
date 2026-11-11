'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/database.types';
import { supabaseEnv } from './env';

let client: SupabaseClient<Database> | undefined;

/** Supabase client for Client Components (one instance per tab). */
export function createBrowserSupabase(): SupabaseClient<Database> {
  if (!client) {
    const { url, publishableKey } = supabaseEnv();
    client = createBrowserClient<Database>(url, publishableKey);
  }
  return client;
}
