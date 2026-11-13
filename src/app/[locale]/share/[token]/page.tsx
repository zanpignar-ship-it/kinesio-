import type { Metadata } from 'next';
import type * as GeoJSON from 'geojson';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlotMapClient } from '@/components/map/map-client';
import { Button } from '@/components/ui/button';
import { packageForToken } from '@/lib/share/public';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; token: string }> };

export default async function SharePage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('share');
  const td = await getTranslations('ship.dds');
  const pkg = await packageForToken(token);
  if (!pkg) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{t('unavailable')}</h1>
        <p className="text-muted-foreground mt-2">{t('unavailableHint')}</p>
      </main>
    );
  }
  const o = pkg.organization;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-primary text-sm font-semibold uppercase">{t('title')}</p>
        <h1 className="text-2xl font-bold tracking-tight">{o.name}</h1>
        <p className="text-muted-foreground text-sm">
          {[o.address, o.country, o.tax_id ? `${t('taxId')}: ${o.tax_id}` : null, o.eori ? `${t('eori')}: ${o.eori}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={`/${locale}/share/${token}/pdf`}>{t('downloadPdf')}</a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/${locale}/share/${token}/geojson`}>{t('downloadGeojson')}</a>
        </Button>
      </div>
      {pkg.shipments.map((sh) => {
        const fc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: sh.plots.map((p, i) => ({ type: 'Feature', properties: { id: `p${i}`, label: p.label, validation_status: 'valid' }, geometry: p.geometry })),
        };
        return (
          <section key={sh.id} className="flex flex-col gap-4 rounded-xl border p-4" data-testid="share-shipment">
            <h2 className="text-lg font-semibold">
              {t('shipment')}: {sh.internal_ref}
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-sm">{t('ddsReference')}</dt>
                <dd className="font-medium" data-testid="share-dds">
                  {sh.dds_reference_no ? `${sh.dds_reference_no}${sh.dds_verification_no ? ` / ${sh.dds_verification_no}` : ''}` : t('notSubmitted')}
                </dd>
              </div>
              {sh.shipment_date ? (
                <div>
                  <dt className="text-muted-foreground text-sm">{t('date')}</dt>
                  <dd className="font-medium">{sh.shipment_date}</dd>
                </div>
              ) : null}
            </dl>
            <div>
              <h3 className="mb-2 font-medium">{t('products')}</h3>
              <ul className="divide-y rounded-md border text-sm">
                {sh.items.map((i, n) => (
                  <li key={n} className="flex flex-wrap gap-x-4 px-3 py-2">
                    <span className="flex-1 font-medium">{i.product}</span>
                    <span>
                      {td('hsCode')} {i.hs_code}
                    </span>
                    <span className="italic">{i.scientific_name}</span>
                    <span className="tabular-nums">{[i.net_mass_kg ? `${i.net_mass_kg} kg` : null, i.volume_m3 ? `${i.volume_m3} m³` : null].filter(Boolean).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
            {sh.plots.length ? (
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">{t('plots')}</h3>
                <PlotMapClient className="h-[45vh] min-h-72" plots={fc} />
                <ul className="divide-y rounded-md border text-sm">
                  {sh.plots.map((p, n) => (
                    <li key={n} className="flex gap-4 px-3 py-2">
                      <span className="flex-1">{p.label}</span>
                      <span>{p.country}</span>
                      <span className="tabular-nums">{p.area_ha ?? '–'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {pkg.include_documents ? (
              <div>
                <h3 className="mb-2 font-medium">{t('documents')}</h3>
                {sh.documents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('noDocuments')}</p>
                ) : (
                  <ul className="list-inside list-disc text-sm">
                    {sh.documents.map((d, n) => (
                      <li key={n}>
                        {d.id ? (
                          <a href={`/${locale}/share/${token}/document/${d.id}`} className="underline underline-offset-4" target="_blank" rel="noreferrer">
                            {d.title}
                          </a>
                        ) : (
                          d.title
                        )}
                        {d.valid_to ? ` (${t('validTo')} ${d.valid_to})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
