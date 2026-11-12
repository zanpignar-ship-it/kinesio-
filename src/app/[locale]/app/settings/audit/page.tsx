import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auditSubject, changedFields } from '@/lib/audit/format';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { listMembers } from '@/lib/members/queries';
import { createServerSupabase } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

const PAGE = 50;
const TABLES = ['plots', 'documents', 'plot_documents', 'shipments', 'shipment_items', 'shipment_plots', 'shipment_documents', 'upstream_references', 'buyer_shares', 'suppliers', 'customers', 'products', 'memberships', 'invitations', 'organizations', 'plot_imports'] as const;

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Who changed what and when (EUDR: keep 5 years). Read-only; rows are written by database triggers. */
export default async function AuditPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/settings/audit');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const sp = await searchParams;
  const table = typeof sp.table === 'string' && (TABLES as readonly string[]).includes(sp.table) ? sp.table : undefined;
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const supabase = await createServerSupabase();
  let query = supabase
    .from('audit_log')
    .select('id, actor_id, table_name, row_id, action, old_data, new_data, at', { count: 'exact' })
    .eq('organization_id', current.organization.id);
  if (table) query = query.eq('table_name', table);
  const [{ data: rows, count }, members] = await Promise.all([query.order('id', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1), listMembers(current.organization.id)]);
  const emails = new Map(members.map((m) => [m.user_id, m.email]));
  const t = await getTranslations('audit');
  const format = await getFormatter();
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number, tb = table) => ({ pathname: '/app/settings/audit', query: { ...(tb ? { table: tb } : {}), ...(p > 1 ? { page: String(p) } : {}) } });
  const tableName = (n: string) => ((TABLES as readonly string[]).includes(n) ? t(`tables.${n as 'plots'}`) : n);
  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/settings" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        ← {t('back')}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('intro')}</p>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label={t('filter')}>
        <Link href={href(1, undefined)} className={cn('rounded-full border px-3 py-1', !table && 'bg-foreground text-background')}>
          {t('all')}
        </Link>
        {(['plots', 'documents', 'shipments', 'buyer_shares', 'memberships'] as const).map((n) => (
          <Link key={n} href={href(1, n)} className={cn('rounded-full border px-3 py-1', table === n && 'bg-foreground text-background')}>
            {tableName(n)}
          </Link>
        ))}
      </nav>
      {(rows ?? []).length === 0 ? <p className="text-muted-foreground text-sm">{t('empty')}</p> : null}
      <ul className="divide-y rounded-xl border text-sm" data-testid="audit-list">
        {(rows ?? []).map((r) => {
          const oldData = r.old_data as Record<string, unknown> | null;
          const newData = r.new_data as Record<string, unknown> | null;
          const fields = r.action === 'UPDATE' ? changedFields(oldData, newData) : [];
          return (
            <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-muted-foreground tabular-nums">{format.dateTime(new Date(r.at), { dateStyle: 'short', timeStyle: 'medium' })}</span>
                <span className="font-medium">
                  {t(`actions.${r.action as 'INSERT'}`)} · {tableName(r.table_name)}
                </span>
                <span className="truncate">{auditSubject(oldData, newData)}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                {r.actor_id ? (emails.get(r.actor_id) ?? t('formerMember')) : t('system')}
                {fields.length ? ` · ${t('fields', { fields: fields.join(', ') })}` : ''}
              </div>
            </li>
          );
        })}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)}>{t('newer')}</Link> : <span />}
          <span className="text-muted-foreground">{t('pageOf', { page, pages })}</span>
          {page < pages ? <Link href={href(page + 1)}>{t('older')}</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
