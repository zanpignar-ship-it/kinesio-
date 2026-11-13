import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, MapPinned, Package, Pencil, XCircle } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Step } from '@/components/shipments/step';
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
  const format = await getFormatter();
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
  const submit = sh.mode === 'submit_dds';
  const riskDone = data.riskLevel === 'low' || Boolean(sh.risk_assessment?.trim()) || Boolean(sh.risk_negligible);
  const fmtNum = (v: number) => format.number(v, { maximumFractionDigits: 3 });
  const ddsData = (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{t('ddsSummary')}</h3>
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
  );
  let n = 0;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/app/shipments" className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-sm transition-colors">
          <ArrowLeft className="size-4" aria-hidden />
          {t('back')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1>{sh.internal_ref}</h1>
          <ShipmentStatusBadge status={data.status} />
          {sh.dds_reference_no ? <span className="text-muted-foreground text-sm">DDS {sh.dds_reference_no}</span> : null}
          <div className="ml-auto flex flex-wrap gap-2">
            {submit ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/${locale}/app/shipments/${sh.id}/geojson`} download>
                  <Download aria-hidden />
                  {t('downloadGeojson')}
                </a>
              </Button>
            ) : null}
            {data.status !== 'submitted' && !(sh.traces_status && TRACES_LOCKED.has(sh.traces_status)) ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/shipments/${sh.id}/edit`}>
                  <Pencil aria-hidden />
                  {t('edit')}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ol className="flex min-w-0 flex-col">
          <Step n={++n} title={t('steps.check')} hint={t('steps.checkHint')} done={data.readiness.ready}>
            {data.readiness.issues.length === 0 ? (
              <p data-testid="checklist-ok" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {t('checklistOk')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label={t('checklist')}>
                {data.readiness.issues.map((i) => (
                  <li
                    key={i.key}
                    data-testid={`check-${i.key}`}
                    className={cn(
                      'flex gap-2.5 rounded-lg px-4 py-3 text-sm',
                      i.level === 'error' ? 'bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100' : 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
                    )}
                  >
                    {i.level === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />}
                    {t(`checks.${i.key}`, i.params ?? {})}
                  </li>
                ))}
              </ul>
            )}
          </Step>

          {submit ? (
            <Step n={++n} title={t('steps.risk')} hint={t('steps.riskHint')} done={riskDone}>
              <RiskForm
                shipmentId={sh.id}
                level={data.riskLevel}
                country={sh.country_of_production}
                assessment={sh.risk_assessment}
                mitigation={sh.risk_mitigation}
                negligible={sh.risk_negligible}
                locked={data.status === 'submitted'}
              />
            </Step>
          ) : null}

          <Step n={++n} title={t('steps.submit')} hint={t(submit ? 'steps.submitHint' : 'steps.referenceHint')} done={data.status === 'submitted'}>
            {submit ? (
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
            {ddsData}
            <StatusActions id={sh.id} status={data.status} ready={data.readiness.ready} ddsReference={sh.dds_reference_no} ddsVerification={sh.dds_verification_no} />
          </Step>

          <Step n={++n} title={t('steps.buyer')} hint={t('steps.buyerHint')} done={(shares ?? []).some((x) => !x.revoked_at)} last>
            <SharePanel shipmentId={sh.id} shares={shares ?? []} />
          </Step>
        </ol>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="font-semibold">{t('summary')}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {sh.customer?.name ? (
                <>
                  <dt className="text-muted-foreground">{t('customer')}</dt>
                  <dd className="text-right font-medium">{sh.customer.name}</dd>
                </>
              ) : null}
              {sh.shipment_date ? (
                <>
                  <dt className="text-muted-foreground">{t('date')}</dt>
                  <dd className="text-right font-medium tabular-nums">{format.dateTime(new Date(`${sh.shipment_date}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' })}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{t('activity')}</dt>
              <dd className="text-right font-medium">{t(`activities.${sh.activity as 'export'}`)}</dd>
            </dl>
          </div>
          {data.items.length ? (
            <div className="flex flex-col gap-2 rounded-xl border p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Package className="text-muted-foreground size-4" aria-hidden />
                {t('items')}
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span className="truncate">{i.product}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {i.netMassKg !== null ? `${fmtNum(i.netMassKg)} kg` : i.volumeM3 !== null ? `${fmtNum(i.volumeM3)} m³` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.plots.length ? (
            <div className="flex flex-col gap-2 rounded-xl border p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <MapPinned className="text-muted-foreground size-4" aria-hidden />
                {t('plots')}
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.plots.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/app/plots/${p.id}`} className="truncate underline-offset-4 hover:underline">
                      {p.label}
                    </Link>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
