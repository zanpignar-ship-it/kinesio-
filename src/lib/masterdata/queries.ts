import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Entity } from './config';

export type Options = { hsCodes: { code: string; label: string; inScope: boolean }[]; species: { id: number; label: string }[] };

export async function listRecords(entity: Entity, organizationId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from(entity).select('*').eq('organization_id', organizationId).order('name').limit(1000);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function getRecord(entity: Entity, organizationId: string, id: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from(entity).select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

/** HS codes and species for product forms, labelled in the user's language. */
export async function productOptions(locale: string): Promise<Options> {
  const supabase = await createServerSupabase();
  const [hs, sp] = await Promise.all([
    supabase.from('hs_codes').select('code, description_sl, description_en, in_scope').order('code'),
    supabase.from('species').select('id, scientific_name, common_name_sl, common_name_hr, common_name_sr, common_name_bs, common_name_en').order('scientific_name'),
  ]);
  const common = (s: NonNullable<typeof sp.data>[number]) =>
    locale === 'sl' ? s.common_name_sl : locale === 'hr' ? s.common_name_hr : locale === 'sr-Latn' ? s.common_name_sr : locale === 'bs' ? s.common_name_bs : s.common_name_en;
  return {
    hsCodes: (hs.data ?? []).map((h) => ({ code: h.code, label: `${h.code} – ${locale === 'sl' ? h.description_sl : h.description_en}`, inScope: h.in_scope })),
    species: (sp.data ?? []).map((s) => ({ id: s.id, label: `${s.scientific_name} (${common(s)})` })),
  };
}
