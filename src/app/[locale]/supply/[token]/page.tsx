import type * as GeoJSON from 'geojson';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { StatusBadge } from '@/components/plots/status-badge';
import { PortalDocumentForm } from '@/components/portal/portal-document-form';
import { PortalPlotForm } from '@/components/portal/portal-plot-form';
import type { PlotStatus } from '@/lib/geo/types';
import { portalInfo } from '@/lib/portal/info';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; token: string }> };

/** Supplier portal: opened from a link, no account. The supplier adds plots and uploads permits. */
export default async function SupplyPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('portal');
  const tdoc = await getTranslations('documents');
  const format = await getFormatter();
  const info = await portalInfo(token);
  if (!info) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight">{t('invalidTitle')}</h1>
        <p className="text-muted-foreground">{t('invalidHint')}</p>
      </main>
    );
  }
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: info.plots.filter((p) => p.geometry).map((p) => ({ type: 'Feature', properties: { id: p.id, label: p.label, validation_status: p.validation_status }, geometry: p.geometry! })),
  };
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark className="size-6" /> IZVOR
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title', { organization: info.organization })}</h1>
        <p className="text-muted-foreground">{t('intro', { supplier: info.supplier })}</p>
        <p className="text-muted-foreground text-xs">{t('validUntil', { date: format.dateTime(new Date(info.expires_at), { dateStyle: 'medium' }) })}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('yourPlots', { count: info.plots.length })}</h2>
        {info.plots.length ? (
          <ul className="divide-y rounded-xl border text-sm" data-testid="portal-plots">
            {info.plots.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="flex-1 font-medium">{p.label}</span>
                {p.harvest_from || p.harvest_to ? <span className="text-muted-foreground">{[p.harvest_from, p.harvest_to].filter(Boolean).join(' – ')}</span> : null}
                <StatusBadge status={p.validation_status as PlotStatus} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t('noPlots')}</p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{t('addPlotTitle')}</h2>
        <PortalPlotForm token={token} existing={fc} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{t('documentsTitle')}</h2>
        {info.documents.length ? (
          <ul className="flex flex-col gap-1 text-sm" data-testid="portal-documents">
            {info.documents.map((d) => (
              <li key={d.id}>
                {d.title} · <span className="text-muted-foreground">{tdoc(`types.${d.type as 'other'}`)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <PortalDocumentForm token={token} organizationId={info.organization_id} linkId={info.link_id} plots={info.plots.map((p) => ({ id: p.id, label: p.label }))} />
      </section>

      <p className="text-muted-foreground text-xs">{t('privacy', { organization: info.organization })}</p>
    </main>
  );
}
