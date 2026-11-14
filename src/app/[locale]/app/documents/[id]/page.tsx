import { notFound } from 'next/navigation';
import { ExternalLink, MapPinned, Pencil } from 'lucide-react';
import { Facts, PageHeader } from '@/components/ui/page';
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
      <PageHeader
        back={{ href: '/app/documents', label: t('back') }}
        title={doc.title}
        badges={<ExpiryBadge expiry={doc.expiry} />}
        actions={
          <>
            {doc.signedUrl ? (
              <Button asChild>
                <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  {t('open')}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/app/documents/${doc.id}/edit`}>
                <Pencil aria-hidden />
                {t('edit')}
              </Link>
            </Button>
          </>
        }
      />
      <Facts
        className="sm:grid-cols-3"
        items={[
          [t('type'), t(`types.${doc.type}`)],
          [t('validFrom'), date(doc.valid_from)],
          [t('validTo'), date(doc.valid_to)],
        ]}
      />
      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <MapPinned className="text-muted-foreground size-4" aria-hidden />
          {t('linkedPlots')}
        </h2>
        {doc.plots.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('noLinkedPlots')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {doc.plots.map((p) => (
              <li key={p.id}>
                <Link href={`/app/plots/${p.id}`} className="bg-secondary text-secondary-foreground hover:bg-accent inline-flex rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
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
