import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex flex-wrap gap-2">
          {rows.length > 0 ? (
            <Button asChild variant="ghost">
              <a href={`/${locale}/app/shipments/export`} download>
                {t('exportCsv')}
              </a>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/app/shipments/new">{t('new')}</Link>
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t('empty')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((s) => (
            <li key={s.id} data-testid="shipment-row" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/app/shipments/${s.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                {s.internal_ref}
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
