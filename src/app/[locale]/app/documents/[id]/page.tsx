import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { DocumentDelete } from '@/components/documents/document-delete';
import { ExpiryBadge } from '@/components/documents/expiry-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { getDocument } from '@/lib/documents/queries';

export default async function DocumentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/app/documents/${id}`);
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await getDocument(current.organization.id, id);
  if (!doc) notFound();
  const t = await getTranslations('documents');
  const format = await getFormatter();
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T00:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' }) : '–');
  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/documents" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        ← {t('back')}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
        <ExpiryBadge expiry={doc.expiry} />
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-sm">{t('type')}</dt>
          <dd className="font-medium">{t(`types.${doc.type}`)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('validFrom')}</dt>
          <dd className="font-medium">{date(doc.valid_from)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('validTo')}</dt>
          <dd className="font-medium">{date(doc.valid_to)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        {doc.signedUrl ? (
          <Button asChild>
            <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
              {t('open')}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/app/documents/${doc.id}/edit`}>{t('edit')}</Link>
        </Button>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t('linkedPlots')}</h2>
        {doc.plots.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('noLinkedPlots')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {doc.plots.map((p) => (
              <li key={p.id}>
                <Link href={`/app/plots/${p.id}`} className="rounded-full border px-3 py-1.5 text-sm underline-offset-4 hover:underline">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <DocumentDelete id={doc.id} />
    </div>
  );
}
