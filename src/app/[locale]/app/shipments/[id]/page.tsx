import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CopyButton } from '@/components/shipments/copy-button';
import { ShipmentStatusBadge } from '@/components/shipments/shipment-status-badge';
import { StatusActions } from '@/components/shipments/status-actions';
import { SharePanel } from '@/components/share/share-panel';
import { RiskForm } from '@/components/shipments/risk-form';
import { TracesPanel } from '@/components/traces/traces-panel';
import { refreshShipmentTraces, TRACES_LOCKED, tracesCheckDue, tracesSettings } from '@/lib/traces/service';

// Submitting to TRACES can take up to a minute (plus a lookup when the answer is lost).
export const maxDuration = 180;
import { createServerSupabase } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/plots/status-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { ddsSummary, productionPeriod } from '@/lib/shipments/dds-summary';
import { getShipment } from '@/lib/shipments/queries';
import { cn } from '@/lib/utils';

export default async function ShipmentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/app/shipments/${id}`);
  const { current } = await getCurrentMembership(user.id);
  if (!current || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let data = await getShipment(current.organization.id, id, locale);
  const isOwner = current.role === 'owner';
  // A submitted statement gets its reference number some time later: ask TRACES at most once an hour.
  const tracesSettingsValue = isOwner ? await tracesSettings(current.organization.id) : null;
  if (data && isOwner && tracesSettingsValue && tracesCheckDue(data.shipment)) {
    if ((await refreshShipmentTraces(current.organization.id, id)) === 'updated') data = await getShipment(current.organization.id, id, locale);
  }
  if (!data) notFound();
  const t = await getTranslations('ship');
  const sh = data.shipment;
  const org = current.organization;
  const fields = ddsSummary({
    activity: sh.activity,
    operator: { name: org.name, country: org.country, eori: org.eori, taxId: org.tax_id },
    internalRef: sh.internal_ref,
    countryOfProduction: sh.country_of_production,
    plotCount: data.plots.filter((p) => p.hasGeometry).length,
    productionPeriod: productionPeriod(data.plots),
    items: data.items.map((i) => ({ hsCode: i.hsCode, description: i.product, tradeName: i.tradeName, scientificName: i.scientificName, commonName: i.commonName, netMassKg: i.netMassKg, volumeM3: i.volumeM3, pieces: i.pieces })),
    references: data.references.map((r) => ({ kind: r.kind, referenceNo: r.reference_no, verificationNo: r.verification_no })),
  });
  const supabase = await createServerSupabase();
  const { data: shares } = await supabase
    .from('buyer_shares')
    .select('id, expires_at, revoked_at, last_viewed_at')
    .eq('organization_id', org.id)
    .contains('shipment_ids', [sh.id])
    .order('created_at', { ascending: false })
    .limit(20);
  const value = (key: string, v: string) => (key === 'activity' ? t(`activities.${v as 'export'}`) : v);
  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/shipments" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        ← {t('back')}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{sh.internal_ref}</h1>
        <ShipmentStatusBadge status={data.status} />
        {sh.dds_reference_no ? <span className="text-muted-foreground text-sm">DDS {sh.dds_reference_no}</span> : null}
        {data.status !== 'submitted' && !(sh.traces_status && TRACES_LOCKED.has(sh.traces_status)) ? (
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href={`/app/shipments/${sh.id}/edit`}>{t('edit')}</Link>
          </Button>
        ) : null}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t('checklist')}</h2>
        {data.readiness.issues.length === 0 ? (
          <p data-testid="checklist-ok" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span aria-hidden>{'✓ '}</span>
            {t('checklistOk')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.readiness.issues.map((i) => (
              <li
                key={i.key}
                data-testid={`check-${i.key}`}
                className={cn('rounded-md border-l-4 px-3 py-2 text-sm', i.level === 'error' ? 'border-red-600 bg-red-50 dark:bg-red-950/40' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/40')}
              >
                {t(`checks.${i.key}`, i.params ?? {})}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sh.mode === 'submit_dds' ? (
        <TracesPanel
          shipmentId={sh.id}
          isOwner={isOwner}
          configured={tracesSettingsValue ? { environment: tracesSettingsValue.environment } : null}
          status={data.status}
          ready={data.readiness.ready}
          traces={{
            uuid: sh.traces_uuid,
            status: sh.traces_status,
            message: sh.traces_message,
            environment: sh.traces_environment,
            submittedAt: sh.traces_submitted_at,
            checkedAt: sh.traces_checked_at,
          }}
        />
      ) : null}

      {sh.mode === 'submit_dds' ? (
        <RiskForm
          shipmentId={sh.id}
          level={data.riskLevel}
          country={sh.country_of_production}
          assessment={sh.risk_assessment}
          mitigation={sh.risk_mitigation}
          negligible={sh.risk_negligible}
          locked={data.status === 'submitted'}
        />
      ) : null}

      {sh.mode === 'submit_dds' ? (
        <Button asChild className="self-start">
          <a href={`/${locale}/app/shipments/${sh.id}/geojson`} download>
            {t('downloadGeojson')}
          </a>
        </Button>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t('ddsSummary')}</h2>
        <p className="text-muted-foreground text-sm">{t('ddsHint')}</p>
        <dl className="divide-y rounded-xl border">
          {fields.map((f, n) => (
            <div key={`${f.key}-${n}`} className="flex flex-wrap items-center gap-x-4 px-4 py-2">
              <dt className="text-muted-foreground w-56 text-sm">
                {t(`dds.${f.key as 'activity'}`)}
                {f.item ? ` · ${t('dds.item', { n: f.item })}` : ''}
              </dt>
              <dd className="flex-1 font-medium break-all" data-testid={`dds-${f.key}`}>
                {value(f.key, f.value)}
              </dd>
              <CopyButton value={value(f.key, f.value)} />
            </div>
          ))}
        </dl>
      </section>

      {data.plots.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t('plots')}</h2>
          <ul className="divide-y rounded-xl border">
            {data.plots.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                <Link href={`/app/plots/${p.id}`} className="flex-1 underline-offset-4 hover:underline">
                  {p.label}
                </Link>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SharePanel shipmentId={sh.id} shares={shares ?? []} />

      <StatusActions id={sh.id} status={data.status} ready={data.readiness.ready} ddsReference={sh.dds_reference_no} ddsVerification={sh.dds_verification_no} />
    </div>
  );
}
