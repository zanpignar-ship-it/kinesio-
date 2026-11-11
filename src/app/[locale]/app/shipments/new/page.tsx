import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShipmentForm } from '@/components/shipments/shipment-form';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { shipmentFormOptions } from '@/lib/shipments/queries';

export default async function NewShipmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/shipments/new');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const options = await shipmentFormOptions(current.organization.id, locale);
  const t = await getTranslations('ship');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('new')}</h1>
      <ShipmentForm options={options} initial={{ activity: current.organization.kind === 'importer' ? 'import' : 'export' }} defaultCountry={current.organization.country} />
    </div>
  );
}
