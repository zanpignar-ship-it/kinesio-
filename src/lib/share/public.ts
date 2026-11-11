import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { isBuyerPackage, type BuyerPackage } from './package';

/** Package behind a share token (anonymous access through public.buyer_package), or null. */
export async function packageForToken(token: string): Promise<BuyerPackage | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('buyer_package', { p_token: token });
  if (error) return null;
  return isBuyerPackage(data) ? data : null;
}
