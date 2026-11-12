import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DrawPlot } from '@/components/map/draw-plot';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { fromGeometry } from '@/lib/map/draw-state';
import { geometryFromDb } from '@/lib/plots/geometry';
import { getPlot, supplierOptions } from '@/lib/plots/queries';

export default async function EditPlotPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/app/plots/${id}/edit`);
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const plot = await getPlot(current.organization.id, id);
  if (!plot) notFound();
  const geometry = geometryFromDb(plot.geom);
  const draw = fromGeometry(geometry);
  const t = await getTranslations('draw');
  const suppliers = await supplierOptions(current.organization.id);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('editTitle')}</h1>
      <DrawPlot
        initial={{
          id: plot.id,
          label: plot.label,
          country: plot.country,
          declaredAreaHa: plot.area_source === 'declared' ? Number(plot.area_ha) : null,
          cadastralNo: plot.cadastral_no,
          cadastralMunicipality: plot.cadastral_municipality,
          supplierId: plot.supplier_id,
          draw,
          multiPart: Boolean(geometry) && !draw,
          geometry,
        }}
        suppliers={suppliers}
      />
    </div>
  );
}
