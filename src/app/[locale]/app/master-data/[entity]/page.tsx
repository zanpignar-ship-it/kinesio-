import { BookOpen, Plus } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui/page';
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
      <PageHeader title={t('title')} />
      <MasterDataTabs active={entity} />
      {entity === 'customers' || entity === 'suppliers' ? <ImportRecords entity={entity} defaultCountry={current.organization.country} /> : null}
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            {t(entity)}
            <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">{rows.length}</span>
          </h2>
          {rows.length === 0 ? (
            <EmptyState icon={BookOpen} title={t('empty')} />
          ) : (
            <ul className="divide-y rounded-xl border">
              {rows.map((r) => (
                <li key={String(r.id)} data-testid="record-row" className="flex flex-wrap items-center gap-x-3 px-4 py-3">
                  <Link href={`/app/master-data/${entity}/${String(r.id)}`} className="min-w-0 flex-1 truncate font-medium">
                    {String(r.name)}
                  </Link>
                  <span className="text-muted-foreground text-sm">{entity === 'products' ? hsLabel(r.hs_code) : String(r.country ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-3 rounded-xl border p-5 lg:sticky lg:top-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Plus className="text-muted-foreground size-4" aria-hidden />
            {t('new')}
          </h2>
          <RecordForm entity={entity} options={options} defaultCountry={current.organization.country} />
        </section>
      </div>
    </div>
  );
}
