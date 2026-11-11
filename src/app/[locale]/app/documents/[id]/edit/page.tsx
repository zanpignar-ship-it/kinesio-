import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocumentForm } from '@/components/documents/document-form';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { getDocument, plotsForPicker } from '@/lib/documents/queries';

export default async function EditDocumentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/app/documents/${id}/edit`);
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [doc, plots] = await Promise.all([getDocument(current.organization.id, id), plotsForPicker(current.organization.id)]);
  if (!doc) notFound();
  const t = await getTranslations('documents');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('editTitle')}</h1>
      <DocumentForm
        organizationId={current.organization.id}
        plots={plots}
        initial={{ id: doc.id, title: doc.title, type: doc.type, validFrom: doc.valid_from, validTo: doc.valid_to, plotIds: doc.plots.map((p) => p.id) }}
      />
    </div>
  );
}
