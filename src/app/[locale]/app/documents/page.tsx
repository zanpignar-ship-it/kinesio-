import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ExpiryBadge } from '@/components/documents/expiry-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { listDocuments, parseDocumentFilters } from '@/lib/documents/queries';
import { cn } from '@/lib/utils';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DocumentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/documents');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const filters = parseDocumentFilters(await searchParams);
  const rows = await listDocuments(current.organization.id, filters);
  const t = await getTranslations('documents');
  const format = await getFormatter();
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' }) : '–');
  const chip = (active: boolean) => cn('rounded-full border px-3 py-1.5 text-sm', active && 'bg-foreground text-background');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Button asChild>
          <Link href="/app/documents/new">{t('new')}</Link>
        </Button>
      </div>
      <nav className="flex flex-wrap gap-2">
        <Link href="/app/documents" className={chip(!filters.expiry)}>
          {t('all')}
        </Link>
        {(['expiring', 'expired', 'valid', 'none'] as const).map((e) => (
          <Link key={e} href={{ pathname: '/app/documents', query: { expiry: e } }} className={chip(filters.expiry === e)}>
            {t(`expiry.${e}`)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t('empty')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((d) => (
            <li key={d.id} data-testid="document-row" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/app/documents/${d.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                {d.title}
              </Link>
              <span className="text-muted-foreground text-sm">{t(`types.${d.type}`)}</span>
              <span className="text-muted-foreground text-sm tabular-nums">{date(d.valid_to)}</span>
              <ExpiryBadge expiry={d.expiry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
