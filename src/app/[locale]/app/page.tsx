import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ChevronRight, FileText, MapPinned, Plus, Sparkles, Truck, XCircle } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { daysUntil, eudrStartDate } from '@/lib/eudr/deadline';
import { expiringDocuments } from '@/lib/documents/queries';
import { plotStatusCounts } from '@/lib/plots/queries';
import { todoItems } from '@/lib/dashboard/todo';
import { Button } from '@/components/ui/button';
import { loadSampleData } from './actions';
import { listShipments } from '@/lib/shipments/queries';
import { ShipmentStatusBadge } from '@/components/shipments/shipment-status-badge';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const PLOT_TILES = [
  { status: 'valid', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300' },
  { status: 'warning', icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300' },
  { status: 'error', icon: XCircle, tone: 'text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-300' },
] as const;

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
  const empty = counts.valid + counts.warning + counts.error === 0 && shipments.length === 0;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{current.organization.name}</p>
          <h1>{t('dashboardTitle')}</h1>
          {user.email ? <p className="text-muted-foreground mt-1 text-sm">{t('welcome', { email: user.email })}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/plots/new">
              <MapPinned aria-hidden />
              {t('quick.plot')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/app/shipments/new">
              <Plus aria-hidden />
              {t('quick.shipment')}
            </Link>
          </Button>
        </div>
      </div>

      <section
        className="bg-sidebar relative overflow-hidden rounded-2xl px-6 py-6 text-white sm:px-8"
        aria-label={t('deadlineTitle', { date: '' })}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'radial-gradient(70% 120% at 100% 0%, oklch(0.55 0.12 156 / 0.5), transparent 60%)' }}
        />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white/10">
            <CalendarClock className="size-6 text-emerald-200" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">
              {t('deadlineTitle', { date: format.dateTime(new Date(`${start}T00:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' }) })}
            </p>
            <p className="text-sm text-emerald-50/80">{days > 0 ? t('deadlineDays', { days }) : t('deadlinePassed')}</p>
          </div>
          {days > 0 ? (
            <p className="text-right">
              <span className="block text-4xl font-semibold tabular-nums">{days}</span>
              <span className="text-xs tracking-wider text-emerald-100/70 uppercase">{t('daysLeft')}</span>
            </p>
          ) : null}
        </div>
      </section>

      {empty ? (
        <Card data-testid="sample" className="border-primary/30 bg-accent/40">
          <CardHeader className="grid-cols-[auto_1fr] gap-x-4">
            <span className="bg-primary text-primary-foreground row-span-2 flex size-10 items-center justify-center rounded-lg">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <CardTitle>{t('sampleTitle')}</CardTitle>
            <CardDescription>{t('sampleText')}</CardDescription>
          </CardHeader>
          <form action={loadSampleData} className="px-6">
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit">{t('sampleButton')}</Button>
          </form>
        </Card>
      ) : null}

      <div className="grid grid-cols-3 gap-3 sm:gap-4" data-testid="plot-counts">
        {PLOT_TILES.map(({ status, icon: Icon, tone }) => (
          <Link
            key={status}
            href={`/app/plots?status=${status}`}
            className="group bg-card flex flex-col gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-4 sm:p-5"
          >
            <span className={cn('flex size-9 shrink-0 items-center sm:size-11 justify-center rounded-lg', tone)}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-2xl font-semibold tabular-nums">{counts[status]}</span>
              <span className="text-muted-foreground text-xs sm:text-sm">
                <span className="hidden sm:inline">{t('plots')} · </span>
                {tp(`status.${status}`)}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card data-testid="todo" className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('todoTitle')}</CardTitle>
            {todos.length === 0 ? (
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                {t('todoNone')}
              </CardDescription>
            ) : null}
          </CardHeader>
          {todos.length > 0 ? (
            <ul className="-mt-2 flex flex-col px-3 text-sm">
              {todos.map((i) => (
                <li key={i.key}>
                  <Link href={i.href} className="hover:bg-muted flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors">
                    <span>{t(`todo.${i.key}`)}</span>
                    <span className="flex items-center gap-2">
                      <span className="bg-secondary text-secondary-foreground min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums">
                        {i.count}
                      </span>
                      <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="text-muted-foreground size-4" aria-hidden />
              {td('expiringCard')}
            </CardTitle>
            {expiring.length === 0 ? <CardDescription>{td('expiringNone')}</CardDescription> : null}
          </CardHeader>
          {expiring.length > 0 ? (
            <ul className="-mt-2 flex flex-col px-3 text-sm">
              {expiring.map((d) => (
                <li key={d.id}>
                  <Link href={`/app/documents/${d.id}`} className="hover:bg-muted flex justify-between gap-3 rounded-lg px-3 py-2 transition-colors">
                    <span className="truncate">{d.title}</span>
                    <span className="shrink-0 text-amber-700 tabular-nums dark:text-amber-300">
                      {d.valid_to ? format.dateTime(new Date(`${d.valid_to}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' }) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <CardTitle className="flex items-center gap-2">
            <Truck className="text-muted-foreground size-4" aria-hidden />
            {t('recentShipments')}
          </CardTitle>
          <Link href="/app/shipments" className="text-primary flex items-center gap-1 text-sm font-medium hover:underline">
            {t('viewAll')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {recent.length === 0 ? <CardDescription className="col-span-2">{ts('empty')}</CardDescription> : null}
        </CardHeader>
        {recent.length > 0 ? (
          <ul className="-mt-2 flex flex-col px-3 text-sm" data-testid="recent-shipments">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/app/shipments/${r.id}`} className="hover:bg-muted flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors">
                  <span className="min-w-0 truncate font-medium">
                    {r.internal_ref}
                    {r.customer?.name ? <span className="text-muted-foreground font-normal"> · {r.customer.name}</span> : null}
                  </span>
                  <ShipmentStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
