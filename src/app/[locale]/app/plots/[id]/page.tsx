import { notFound } from 'next/navigation';
import { FileText, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Facts, PageHeader } from '@/components/ui/page';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type * as GeoJSON from 'geojson';
import { PlotMapClient } from '@/components/map/map-client';
import { IssueList } from '@/components/plots/issue-list';
import { geometryFromDb } from '@/lib/plots/geometry';
import { PlotActions } from '@/components/plots/plot-actions';
import { RepairButton } from '@/components/plots/repair-button';
import { StatusBadge } from '@/components/plots/status-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import type { Issue } from '@/lib/geo/types';
import { getPlot } from '@/lib/plots/queries';
import { documentsForPlot } from '@/lib/documents/queries';
import { ExpiryBadge } from '@/components/documents/expiry-badge';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function PlotPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/app/plots/${id}`);
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const plot = await getPlot(current.organization.id, id);
  if (!plot) notFound();
  const t = await getTranslations('plots');
  const td = await getTranslations('documents');
  const format = await getFormatter();
  const documents = await documentsForPlot(current.organization.id, plot.id);
  const geometry = geometryFromDb(plot.geom);
  const single: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: geometry ? [{ type: 'Feature', properties: { id: plot.id, label: plot.label, validation_status: plot.validation_status }, geometry }] : [],
  };
  const issues = (Array.isArray(plot.validation_issues) ? plot.validation_issues : []) as unknown as Issue[];
  const facts: [string, string | null][] = [
    [t('country'), plot.country],
    [t('supplier'), plot.supplier?.name ?? null],
    [
      t('harvest'),
      plot.harvest_from || plot.harvest_to
        ? [plot.harvest_from, plot.harvest_to]
            .filter((d): d is string => Boolean(d))
            .map((d) => format.dateTime(new Date(`${d}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' }))
            .join(' – ')
        : null,
    ],
    [t('area'), plot.area_ha === null ? null : t('hectares', { value: format.number(Number(plot.area_ha), { maximumFractionDigits: 4 }) })],
    [t('cadastral'), plot.cadastral_no],
    [t('cadastralMunicipality'), plot.cadastral_municipality],
    [t('postalAddress'), plot.postal_address],
    [t('updated'), format.dateTime(new Date(plot.updated_at), { dateStyle: 'medium', timeStyle: 'short' })],
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: '/app/plots', label: t('back') }}
        title={plot.label}
        badges={
          <>
            <StatusBadge status={plot.validation_status} />
            {plot.archived_at ? <span className="text-muted-foreground text-sm">{t('archived')}</span> : null}
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/plots/${plot.id}/edit`}>
              <Pencil aria-hidden />
              {t('edit')}
            </Link>
          </Button>
        }
      />
      <div className={geometry ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]' : 'flex flex-col gap-6'}>
        {geometry ? <PlotMapClient className="h-[50vh] min-h-72 overflow-hidden rounded-xl border" plots={single} /> : null}
        <Facts items={facts} className={geometry ? 'sm:grid-cols-2 lg:grid-cols-1' : undefined} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="text-muted-foreground size-4" aria-hidden />
            {t('issues')}
          </h2>
          <IssueList issues={issues} />
          {issues.some((i) => i.code === 'POLYGON_SELF_INTERSECTION') ? <RepairButton id={plot.id} /> : null}
        </section>
        <section className="flex flex-col gap-3 rounded-xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileText className="text-muted-foreground size-4" aria-hidden />
              {td('title')}
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href={{ pathname: '/app/documents/new', query: { plot: plot.id } }}>
                <Plus aria-hidden />
                {td('new')}
              </Link>
            </Button>
          </div>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{td('empty')}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {documents.map((d) => (
                <li key={d.id}>
                  <Link href={`/app/documents/${d.id}`} className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2 transition-colors">
                    <span className="flex-1 truncate">{d.title}</span>
                    <ExpiryBadge expiry={d.expiry} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <PlotActions id={plot.id} archived={Boolean(plot.archived_at)} />
    </div>
  );
}
