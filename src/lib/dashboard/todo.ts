import 'server-only';
import { isoDateIn } from '@/lib/documents/expiry';
import { createServerSupabase } from '@/lib/supabase/server';

export type TodoKey = 'plotErrors' | 'plotsNoHarvest' | 'plotsNoSupplier' | 'expiredDocuments' | 'draftShipments' | 'readyShipments';
export type Todo = { key: TodoKey; count: number; href: string };

/** Open work, most urgent first; only items with a count above zero. */
export async function todoItems(organizationId: string): Promise<Todo[]> {
  const supabase = await createServerSupabase();
  const plots = () => supabase.from('plots').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('archived_at', null);
  const ships = () => supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId);
  const today = isoDateIn(0);
  const [errors, noHarvest, noSupplier, expired, drafts, ready] = await Promise.all([
    plots().eq('validation_status', 'error'),
    plots().is('harvest_from', null).is('harvest_to', null),
    plots().is('supplier_id', null),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).lt('valid_to', today),
    ships().eq('status', 'draft'),
    ships().eq('status', 'ready'),
  ]);
  const items: Todo[] = [
    { key: 'plotErrors', count: errors.count ?? 0, href: '/app/plots?status=error' },
    { key: 'expiredDocuments', count: expired.count ?? 0, href: '/app/documents?expiry=expired' },
    { key: 'readyShipments', count: ready.count ?? 0, href: '/app/shipments' },
    { key: 'draftShipments', count: drafts.count ?? 0, href: '/app/shipments' },
    { key: 'plotsNoHarvest', count: noHarvest.count ?? 0, href: '/app/plots' },
    { key: 'plotsNoSupplier', count: noSupplier.count ?? 0, href: '/app/plots' },
  ];
  return items.filter((i) => i.count > 0);
}
