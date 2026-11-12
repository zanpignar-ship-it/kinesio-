import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RecordForm } from '@/components/masterdata/record-form';
import { MasterDataTabs } from '@/components/masterdata/tabs';
import { ImportRecords } from '@/components/masterdata/import-records';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { isEntity } from '@/lib/masterdata/config';
import { listRecords, productOptions } from '@/lib/masterdata/queries';

export default async function MasterDataPage({ params }: { params: Promise<{ locale: string; entity: string }> }) {
  const { locale, entity } = await params;
  setRequestLocale(locale);
  if (!isEntity(entity)) notFound();
  const user = await requireUser(locale, `/app/master-data/${entity}`);
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const [rows, options] = await Promise.all([listRecords(entity, current.organization.id), entity === 'products' ? productOptions(locale) : Promise.resolve(undefined)]);
  const t = await getTranslations('md');
  const hsLabel = (code: unknown) => options?.hsCodes.find((h) => h.code === code)?.label ?? String(code ?? '');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <MasterDataTabs active={entity} />
      {entity === 'customers' || entity === 'suppliers' ? <ImportRecords entity={entity} defaultCountry={current.organization.country} /> : null}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{t(entity)}</h2>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {rows.map((r) => (
                <li key={String(r.id)} data-testid="record-row" className="flex flex-wrap items-center gap-x-3 px-4 py-3">
                  <Link href={`/app/master-data/${entity}/${String(r.id)}`} className="flex-1 font-medium underline-offset-4 hover:underline">
                    {String(r.name)}
                  </Link>
                  <span className="text-muted-foreground text-sm">{entity === 'products' ? hsLabel(r.hs_code) : String(r.country ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('new')}</h2>
          <RecordForm entity={entity} options={options} defaultCountry={current.organization.country} />
        </section>
      </div>
    </div>
  );
}
