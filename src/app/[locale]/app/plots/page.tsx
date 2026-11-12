import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import type * as GeoJSON from 'geojson';
import { PlotsOverviewMap } from '@/components/map/plots-overview-map';
import { StatusBadge } from '@/components/plots/status-badge';
import { createServerSupabase } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import type { PlotStatus } from '@/lib/geo/types';
import { PAGE_SIZE, listPlots, parseFilters, supplierOptions } from '@/lib/plots/queries';
import { cn } from '@/lib/utils';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlotsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/plots');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const filters = parseFilters(await searchParams);
  const supabase = await createServerSupabase();
  const [{ rows, total, byStatus, archivedCount }, map, suppliers] = await Promise.all([
    listPlots(current.organization.id, filters),
    supabase.rpc('plots_map', { p_org: current.organization.id }),
    supplierOptions(current.organization.id),
  ]);
  const mapData = (map.data ?? { type: 'FeatureCollection', features: [] }) as unknown as GeoJSON.FeatureCollection;
  const t = await getTranslations('plots');
  const format = await getFormatter();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const all = byStatus.valid + byStatus.warning + byStatus.error;
  const href = (overrides: Partial<{ status: PlotStatus | undefined; page: number; archived: boolean }>) => {
    const query: Record<string, string> = {};
    if (overrides.archived ?? (filters.archived && !('status' in overrides))) query.archived = '1';
    const status = 'status' in overrides ? overrides.status : filters.status;
    if (status) query.status = status;
    if (filters.q) query.q = filters.q;
    if (filters.country) query.country = filters.country;
    if (filters.supplier) query.supplier = filters.supplier;
    const page = overrides.page ?? 1;
    if (page > 1) query.page = String(page);
    return { pathname: '/app/plots', query };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/app/plots/import">{t('import')}</Link>
          </Button>
          <Button asChild>
            <Link href="/app/plots/new">{t('new')}</Link>
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t('issues')}>
        <Link href={href({ status: undefined, archived: false })} className={cn('rounded-full border px-3 py-1.5 text-sm', !filters.status && !filters.archived && 'bg-foreground text-background')}>
          {t('all')} <span data-testid="count-all">{all}</span>
        </Link>
        {(['valid', 'warning', 'error'] as const).map((s) => (
          <Link key={s} href={href({ status: s, archived: false })} className={cn('rounded-full border px-3 py-1.5 text-sm', filters.status === s && !filters.archived && 'bg-foreground text-background')}>
            {t(`status.${s}`)} <span data-testid={`count-${s}`}>{byStatus[s]}</span>
          </Link>
        ))}
        {archivedCount > 0 || filters.archived ? (
          <Link href={href({ status: undefined, archived: true })} className={cn('rounded-full border px-3 py-1.5 text-sm', filters.archived && 'bg-foreground text-background')}>
            {t('archivedFilter')} <span data-testid="count-archived">{archivedCount}</span>
          </Link>
        ) : null}
      </nav>

      {mapData.features.length > 0 ? <PlotsOverviewMap plots={mapData} className="h-[45vh] min-h-72" /> : null}

      <form className="flex flex-wrap gap-2" action="" method="get">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        {filters.archived ? <input type="hidden" name="archived" value="1" /> : null}
        <label htmlFor="q" className="sr-only">
          {t('search')}
        </label>
        <input id="q" name="q" defaultValue={filters.q} placeholder={t('search')} className="border-input h-10 w-full max-w-sm rounded-md border bg-transparent px-3 text-base md:text-sm" />
        {suppliers.length > 0 ? (
          <>
            <label htmlFor="supplier" className="sr-only">
              {t('supplier')}
            </label>
            <select id="supplier" name="supplier" defaultValue={filters.supplier ?? ''} className="border-input h-10 max-w-56 rounded-md border bg-transparent px-3 text-sm">
              <option value="">{t('allSuppliers')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Button type="submit" variant="outline">
          {t('searchButton')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t('empty')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((p) => (
            <li key={p.id} data-testid="plot-row" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/app/plots/${p.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                {p.label}
              </Link>
              <span className="text-muted-foreground text-sm">{p.country}</span>
              <span className="text-muted-foreground w-24 text-right text-sm tabular-nums">
                {p.area_ha === null ? '–' : t('hectares', { value: format.number(Number(p.area_ha), { maximumFractionDigits: 2 }) })}
              </span>
              <StatusBadge status={p.validation_status} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {filters.page > 1 ? <Link href={href({ page: filters.page - 1 })}>{t('previous')}</Link> : <span />}
          <span className="text-muted-foreground">{t('pageOf', { page: filters.page, pages })}</span>
          {filters.page < pages ? <Link href={href({ page: filters.page + 1 })}>{t('next')}</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
