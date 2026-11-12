import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShipmentForm } from '@/components/shipments/shipment-form';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { getShipment, shipmentFormOptions } from '@/lib/shipments/queries';

const s = (v: number | null) => (v === null ? '' : String(v));

export default async function EditShipmentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/app/shipments/${id}/edit`);
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, options] = await Promise.all([getShipment(current.organization.id, id, locale), shipmentFormOptions(current.organization.id, locale)]);
  if (!data) notFound();
  const t = await getTranslations('ship');
  if (data.status === 'submitted') return <p>{t('locked')}</p>;
  const sh = data.shipment;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('editTitle')}</h1>
      <ShipmentForm
        options={options}
        defaultCountry={current.organization.country}
        initial={{
          id: sh.id,
          internalRef: sh.internal_ref,
          customerId: sh.customer_id,
          shipmentDate: sh.shipment_date,
          mode: sh.mode,
          activity: sh.activity,
          countryOfProduction: sh.country_of_production,
          items: data.items.map((i) => ({ productId: i.productId, netMassKg: s(i.netMassKg), volumeM3: s(i.volumeM3), pieces: s(i.pieces), plotIds: i.plotIds })),
          plotIds: data.plots.map((p) => p.id),
          documentIds: data.documents.map((d) => d.id),
          references: data.references.map((r) => ({ kind: r.kind, referenceNo: r.reference_no, verificationNo: r.verification_no ?? '', supplierId: r.supplier_id ?? '' })),
        }}
      />
    </div>
  );
}
