import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RecordForm } from '@/components/masterdata/record-form';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { isEntity, toFormValues } from '@/lib/masterdata/config';
import { getRecord, productOptions } from '@/lib/masterdata/queries';

export default async function RecordPage({ params }: { params: Promise<{ locale: string; entity: string; id: string }> }) {
  const { locale, entity, id } = await params;
  setRequestLocale(locale);
  if (!isEntity(entity) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(locale, `/app/master-data/${entity}/${id}`);
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const [row, options] = await Promise.all([getRecord(entity, current.organization.id, id), entity === 'products' ? productOptions(locale) : Promise.resolve(undefined)]);
  if (!row) notFound();
  const t = await getTranslations('md');
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/app/master-data/${entity}`} className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        ← {t(entity)}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{String(row.name)}</h1>
      <RecordForm entity={entity} id={id} values={toFormValues(entity, row)} options={options} defaultCountry={current.organization.country} />
    </div>
  );
}
