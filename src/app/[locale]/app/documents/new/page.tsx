import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocumentForm } from '@/components/documents/document-form';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { plotsForPicker } from '@/lib/documents/queries';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ plot?: string }> };

export default async function NewDocumentPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/documents/new');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const plots = await plotsForPicker(current.organization.id);
  const preselected = (await searchParams).plot;
  const t = await getTranslations('documents');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('new')}</h1>
      <DocumentForm organizationId={current.organization.id} plots={plots} initial={{ plotIds: preselected && plots.some((p) => p.id === preselected) ? [preselected] : [] }} />
    </div>
  );
}
