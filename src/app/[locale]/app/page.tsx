import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { daysUntil, eudrStartDate } from '@/lib/eudr/deadline';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const t = await getTranslations('app');
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
      <div className="grid gap-4 sm:grid-cols-3">
        {(['plots', 'documents', 'shipments'] as const).map((k) => (
          <Card key={k}>
            <CardHeader>
              <CardTitle>{t(k)}</CardTitle>
              <CardDescription>{t('comingSoon')}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
