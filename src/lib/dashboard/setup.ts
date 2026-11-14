import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export type SetupKey = 'supplier' | 'plot' | 'document' | 'shipment';
export type SetupStep = { key: SetupKey; done: boolean; href: string };

/** First-run checklist: one row per building block, done once the organization has at least one. */
export async function setupSteps(organizationId: string): Promise<SetupStep[]> {
  const supabase = await createServerSupabase();
  const count = (table: 'suppliers' | 'plots' | 'documents' | 'shipments') =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId);
  const [suppliers, plots, documents, shipments] = await Promise.all([count('suppliers'), count('plots'), count('documents'), count('shipments')]);
  return [
    { key: 'supplier', done: (suppliers.count ?? 0) > 0, href: '/app/master-data/suppliers' },
    { key: 'plot', done: (plots.count ?? 0) > 0, href: '/app/plots/new' },
    { key: 'document', done: (documents.count ?? 0) > 0, href: '/app/documents/new' },
    { key: 'shipment', done: (shipments.count ?? 0) > 0, href: '/app/shipments/new' },
  ];
}
