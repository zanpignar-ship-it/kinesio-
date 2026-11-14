import { FileText, Plus } from 'lucide-react';
import { chipClass, EmptyState, PageHeader } from '@/components/ui/page';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ExpiryBadge } from '@/components/documents/expiry-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { listDocuments, parseDocumentFilters } from '@/lib/documents/queries';

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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link href="/app/documents/new">
              <Plus aria-hidden />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <nav className="flex flex-wrap gap-2">
        <Link href="/app/documents" className={chipClass(!filters.expiry)}>
          {t('all')}
        </Link>
        {(['expiring', 'expired', 'valid', 'none'] as const).map((e) => (
          <Link key={e} href={{ pathname: '/app/documents', query: { expiry: e } }} className={chipClass(filters.expiry === e)}>
            {t(`expiry.${e}`)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={t('empty')} hint={t('emptyHint')} />
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((d) => (
            <li key={d.id} data-testid="document-row" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/app/documents/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3 font-medium">
                <span className="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="truncate">{d.title}</span>
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
