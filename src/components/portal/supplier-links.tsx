import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { revokeSupplierLink } from '@/app/[locale]/app/master-data/supplier-link-actions';
import { createServerSupabase } from '@/lib/supabase/server';
import { SupplierLinkForm } from './supplier-link-form';

/** Supplier portal links of one supplier: create, see when they were used, revoke. */
export async function SupplierLinks({ organizationId, supplierId }: { organizationId: string; supplierId: string }) {
  const t = await getTranslations('portal');
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createServerSupabase();
  const { data: links } = await supabase
    .from('supplier_links')
    .select('id, expires_at, revoked_at, last_used_at, created_at')
    .eq('organization_id', organizationId)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(20);
  const date = (d: string) => format.dateTime(new Date(d), { dateStyle: 'medium' });
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4" data-testid="supplier-links">
      <h2 className="text-lg font-semibold">{t('ownerTitle')}</h2>
      <p className="text-muted-foreground text-sm">{t('ownerIntro')}</p>
      <SupplierLinkForm supplierId={supplierId} />
      {links?.length ? (
        <ul className="divide-y text-sm">
          {links.map((l) => {
            const active = !l.revoked_at && new Date(l.expires_at) > new Date();
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1">
                  {active ? t('activeUntil', { date: date(l.expires_at) }) : l.revoked_at ? t('revoked') : t('expired')}
                  <span className="text-muted-foreground"> · {l.last_used_at ? t('lastUsed', { date: date(l.last_used_at) }) : t('neverUsed')}</span>
                </span>
                {active ? (
                  <form action={revokeSupplierLink}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="supplierId" value={supplierId} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t('revoke')}
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
