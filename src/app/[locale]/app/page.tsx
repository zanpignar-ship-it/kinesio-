import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { daysUntil, eudrStartDate } from '@/lib/eudr/deadline';
import { expiringDocuments } from '@/lib/documents/queries';
import { plotStatusCounts } from '@/lib/plots/queries';
import { todoItems } from '@/lib/dashboard/todo';
import { listShipments } from '@/lib/shipments/queries';
import { ShipmentStatusBadge } from '@/components/shipments/shipment-status-badge';
import { Link } from '@/i18n/navigation';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const t = await getTranslations('app');
  const td = await getTranslations('documents');
  const tp = await getTranslations('plots');
  const ts = await getTranslations('ship');
  const [expiring, counts, shipments, todos] = await Promise.all([
    expiringDocuments(current.organization.id),
    plotStatusCounts(current.organization.id),
    listShipments(current.organization.id),
    todoItems(current.organization.id),
  ]);
  const recent = shipments.slice(0, 5);
  const format = await getFormatter();
  const start = eudrStartDate(current.organization.size, current.organization.was_under_eutr);
  const days = daysUntil(start);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboardTitle')}</h1>
        {user.email ? <p className="text-muted-foreground mt-1">{t('welcome', { email: user.email })}</p> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('deadlineTitle', { date: format.dateTime(new Date(`${start}T00:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' }) })}</CardTitle>
          <CardDescription>{days > 0 ? t('deadlineDays', { days }) : t('deadlinePassed')}</CardDescription>
        </CardHeader>
      </Card>
      <Card data-testid="todo">
        <CardHeader>
          <CardTitle>{t('todoTitle')}</CardTitle>
          {todos.length === 0 ? <CardDescription>{t('todoNone')}</CardDescription> : null}
        </CardHeader>
        {todos.length > 0 ? (
          <ul className="flex flex-col gap-1 px-6 text-sm">
            {todos.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="flex justify-between gap-3 underline-offset-4 hover:underline">
                  <span>{t(`todo.${i.key}`)}</span>
                  <span className="font-medium tabular-nums">{i.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{td('expiringCard')}</CardTitle>
          {expiring.length === 0 ? <CardDescription>{td('expiringNone')}</CardDescription> : null}
        </CardHeader>
        {expiring.length > 0 ? (
          <ul className="flex flex-col gap-1 px-6 text-sm">
            {expiring.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <Link href={`/app/documents/${d.id}`} className="underline-offset-4 hover:underline">
                  {d.title}
                </Link>
                <span className="text-muted-foreground tabular-nums">
                  {d.valid_to ? format.dateTime(new Date(`${d.valid_to}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' }) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/app/plots" className="underline-offset-4 hover:underline">
                {t('plots')}
              </Link>
            </CardTitle>
          </CardHeader>
          <ul className="flex flex-col gap-1 px-6 text-sm" data-testid="plot-counts">
            {(['valid', 'warning', 'error'] as const).map((s) => (
              <li key={s}>
                <Link href={`/app/plots?status=${s}`} className="flex justify-between gap-3 underline-offset-4 hover:underline">
                  <span>{tp(`status.${s}`)}</span>
                  <span className="font-medium tabular-nums">{counts[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/app/shipments" className="underline-offset-4 hover:underline">
                {t('recentShipments')}
              </Link>
            </CardTitle>
            {recent.length === 0 ? <CardDescription>{ts('empty')}</CardDescription> : null}
          </CardHeader>
          {recent.length > 0 ? (
            <ul className="flex flex-col gap-2 px-6 text-sm" data-testid="recent-shipments">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <Link href={`/app/shipments/${r.id}`} className="truncate underline-offset-4 hover:underline">
                    {r.internal_ref}
                    {r.customer?.name ? <span className="text-muted-foreground"> · {r.customer.name}</span> : null}
                  </Link>
                  <ShipmentStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/app/documents" className="underline-offset-4 hover:underline">
          {t('documents')}
        </Link>
        <Link href="/app/master-data" className="underline-offset-4 hover:underline">
          {t('nav.masterData')}
        </Link>
      </div>
    </div>
  );
}
