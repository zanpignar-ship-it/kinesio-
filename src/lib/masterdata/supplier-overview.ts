import 'server-only';
import { documentExpiry } from '@/lib/documents/expiry';
import { createServerSupabase } from '@/lib/supabase/server';

/** Plots of one supplier (active only) with their documents – the supply-chain view for inspections. */
export async function supplierOverview(organizationId: string, supplierId: string) {
  const supabase = await createServerSupabase();
  const { data: plots } = await supabase
    .from('plots')
    .select('id, label, validation_status, harvest_from, harvest_to, plot_documents (document:documents (id, title, valid_to))')
    .eq('organization_id', organizationId)
    .eq('supplier_id', supplierId)
    .is('archived_at', null)
    .order('label')
    .limit(200);
  const rows = (plots ?? []).map((p) => {
    const docs = p.plot_documents.flatMap((l) => (l.document ? [l.document] : []));
    return {
      id: p.id,
      label: p.label,
      status: p.validation_status,
      harvest: [p.harvest_from, p.harvest_to].filter(Boolean).join(' – '),
      documents: docs.length,
      expired: docs.filter((d) => documentExpiry(d.valid_to) === 'expired').length,
    };
  });
  const { count } = await supabase
    .from('plots')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('supplier_id', supplierId)
    .is('archived_at', null);
  return { rows, total: count ?? rows.length };
}
