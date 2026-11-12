import { getTranslations } from 'next-intl/server';
import { StatusBadge } from '@/components/plots/status-badge';
import { Link } from '@/i18n/navigation';
import { supplierOverview } from '@/lib/masterdata/supplier-overview';

export async function SupplierOverview({ organizationId, supplierId }: { organizationId: string; supplierId: string }) {
  const t = await getTranslations('md');
  const { rows, total } = await supplierOverview(organizationId, supplierId);
  const noDocs = rows.filter((r) => r.documents === 0).length;
  const expired = rows.reduce((n, r) => n + r.expired, 0);
  return (
    <section className="flex flex-col gap-3" data-testid="supplier-overview">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('supplierPlots', { count: total })}</h2>
        {total > 0 ? (
          <Link href={{ pathname: '/app/plots', query: { supplier: supplierId } }} className="text-sm underline-offset-4 hover:underline">
            {t('showAllPlots')}
          </Link>
        ) : null}
      </div>
      {total === 0 ? <p className="text-muted-foreground text-sm">{t('supplierNoPlots')}</p> : null}
      {noDocs > 0 || expired > 0 ? (
        <p className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">
          {noDocs > 0 ? t('supplierPlotsNoDocs', { count: noDocs }) : null} {expired > 0 ? t('supplierExpiredDocs', { count: expired }) : null}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="divide-y rounded-xl border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
              <Link href={`/app/plots/${r.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                {r.label}
              </Link>
              {r.harvest ? <span className="text-muted-foreground tabular-nums">{r.harvest}</span> : null}
              <span className="text-muted-foreground">{t('documentsCount', { count: r.documents })}</span>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
