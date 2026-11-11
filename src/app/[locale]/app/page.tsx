import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { daysUntil, eudrStartDate } from '@/lib/eudr/deadline';
import { expiringDocuments } from '@/lib/documents/queries';
import { Link } from '@/i18n/navigation';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const t = await getTranslations('app');
  const td = await getTranslations('documents');
  const expiring = await expiringDocuments(current.organization.id);
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
      <div className="grid gap-4 sm:grid-cols-3">
        {(['plots', 'documents'] as const).map((k) => (
          <Link key={k} href={`/app/${k}`} className="rounded-xl">
            <Card className="h-full hover:border-primary">
              <CardHeader>
                <CardTitle>{t(k)}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Link href="/app/shipments" className="rounded-xl">
          <Card className="h-full hover:border-primary">
            <CardHeader>
              <CardTitle>{t('shipments')}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
