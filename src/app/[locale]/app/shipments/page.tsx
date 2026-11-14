import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Truck } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui/page';
import { ShipmentStatusBadge } from '@/components/shipments/shipment-status-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { listShipments } from '@/lib/shipments/queries';

export default async function ShipmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/shipments');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const rows = await listShipments(current.organization.id);
  const t = await getTranslations('ship');
  const format = await getFormatter();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        actions={
          <>
          {rows.length > 0 ? (
            <Button asChild variant="ghost">
              <a href={`/${locale}/app/shipments/export`} download>
                {t('exportCsv')}
              </a>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/app/shipments/new">
              <Plus aria-hidden />
              {t('new')}
            </Link>
          </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t('empty')}
          hint={t('emptyHint')}
          action={
            <Button asChild>
              <Link href="/app/shipments/new">
                <Plus aria-hidden />
                {t('new')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((s) => (
            <li key={s.id} data-testid="shipment-row" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/app/shipments/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 font-medium">
                <span className="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Truck className="size-4" aria-hidden />
                </span>
                <span className="truncate">{s.internal_ref}</span>
              </Link>
              <span className="text-muted-foreground text-sm">{s.customer?.name ?? ''}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {s.shipment_date ? format.dateTime(new Date(`${s.shipment_date}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' }) : ''}
              </span>
              <ShipmentStatusBadge status={s.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
