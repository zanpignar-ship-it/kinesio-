import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImportWizard } from '@/components/plots/import-wizard';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';

export default async function ImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/plots/import');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const t = await getTranslations('imp');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('intro')}</p>
      <ImportWizard organizationId={current.organization.id} defaultCountry={current.organization.country} />
    </div>
  );
}
