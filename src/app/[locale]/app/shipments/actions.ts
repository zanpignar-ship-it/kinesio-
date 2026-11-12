'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { getPlotContext } from '@/lib/plots/context';
import { nextCopyRef } from '@/lib/shipments/next-ref';
import { getShipment } from '@/lib/shipments/queries';
import { shipmentFormSchema, submitSchema, type ShipmentFormInput } from '@/lib/shipments/schemas';

export type ShipmentFormState = { error?: string; saved?: boolean };
type Ctx = NonNullable<Awaited<ReturnType<typeof getPlotContext>>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};

/**
 * Replace items, plots (with a geometry snapshot taken now), documents and supplier references of a shipment.
 * Every insert carries organization_id; composite foreign keys reject rows of other organizations.
 */
async function writeChildren(ctx: Ctx, shipmentId: string, data: ShipmentFormInput): Promise<boolean> {
  const { supabase, organizationId: org } = ctx;
  const del = await Promise.all([
    supabase.from('shipment_items').delete().eq('organization_id', org).eq('shipment_id', shipmentId),
    supabase.from('shipment_plots').delete().eq('organization_id', org).eq('shipment_id', shipmentId),
    supabase.from('shipment_documents').delete().eq('organization_id', org).eq('shipment_id', shipmentId),
    supabase.from('upstream_references').delete().eq('organization_id', org).eq('shipment_id', shipmentId),
  ]);
  if (del.some((r) => r.error)) return false;

  if (data.items.length) {
    const { error } = await supabase.from('shipment_items').insert(
      data.items.map((i) => ({ organization_id: org, shipment_id: shipmentId, product_id: i.productId, net_mass_kg: i.netMassKg, volume_m3: i.volumeM3, pieces: i.pieces })),
    );
    if (error) return false;
  }
  if (data.plotIds.length) {
    const { data: plots, error: readError } = await supabase.from('plots').select('id, geom').eq('organization_id', org).in('id', data.plotIds);
    if (readError) return false;
    const { error } = await supabase
      .from('shipment_plots')
      .insert((plots ?? []).map((p) => ({ organization_id: org, shipment_id: shipmentId, plot_id: p.id, geom_snapshot: p.geom as string | null })));
    if (error) return false;
  }
  if (data.documentIds.length) {
    const { error } = await supabase.from('shipment_documents').insert(data.documentIds.map((d) => ({ organization_id: org, shipment_id: shipmentId, document_id: d })));
    if (error) return false;
  }
  if (data.references.length) {
    const { error } = await supabase.from('upstream_references').insert(
      data.references.map((r) => ({ organization_id: org, shipment_id: shipmentId, kind: r.kind, reference_no: r.referenceNo, verification_no: r.verificationNo, supplier_id: r.supplierId })),
    );
    if (error) return false;
  }
  return true;
}

export async function saveShipment(_prev: ShipmentFormState, formData: FormData): Promise<ShipmentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const id = str(formData, 'id');
  const ctx = await getPlotContext();
  if (!ctx) return { error: 'ship.errors.unknown' };
  const parsed = shipmentFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ship.errors.unknown' };
  const d = parsed.data;
  const columns = {
    internal_ref: d.internalRef,
    customer_id: d.customerId,
    shipment_date: d.shipmentDate,
    mode: d.mode,
    activity: d.activity,
    country_of_production: d.countryOfProduction,
  };
  let shipmentId = id;
  if (id) {
    if (!UUID.test(id)) return { error: 'ship.errors.unknown' };
    const { data: existing } = await ctx.supabase.from('shipments').select('status').eq('organization_id', ctx.organizationId).eq('id', id).maybeSingle();
    if (!existing) return { error: 'ship.errors.unknown' };
    if (existing.status === 'submitted') return { error: 'ship.locked' };
    // Editing a shipment makes it a draft again until the checklist is confirmed.
    const { error } = await ctx.supabase.from('shipments').update({ ...columns, status: 'draft' }).eq('organization_id', ctx.organizationId).eq('id', id);
    if (error) return { error: 'ship.errors.unknown' };
  } else {
    const { data, error } = await ctx.supabase.from('shipments').insert({ ...columns, organization_id: ctx.organizationId }).select('id').single();
    if (error || !data) return { error: 'ship.errors.unknown' };
    shipmentId = data.id;
  }
  if (!(await writeChildren(ctx, shipmentId, d))) return { error: 'ship.errors.unknown' };
  revalidatePath(`/${locale}/app/shipments`);
  redirect({ href: `/app/shipments/${shipmentId}`, locale });
  return {};
}

export async function setShipmentStatus(_prev: ShipmentFormState, formData: FormData): Promise<ShipmentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const id = str(formData, 'id');
  const next = str(formData, 'status');
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return { error: 'ship.errors.unknown' };
  const current = await getShipment(ctx.organizationId, id, locale);
  if (!current) return { error: 'ship.errors.unknown' };
  let update: { status: 'ready' | 'submitted' | 'rejected'; dds_reference_no?: string; dds_verification_no?: string | null; submitted_at?: string };
  if (next === 'ready') {
    if (!current.readiness.ready) return { error: 'ship.errors.notReady' };
    update = { status: 'ready' };
  } else if (next === 'submitted') {
    if (current.shipment.status !== 'ready' || !current.readiness.ready) return { error: 'ship.errors.notReady' };
    const parsed = submitSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ship.errors.ddsReference' };
    update = { status: 'submitted', dds_reference_no: parsed.data.ddsReference, dds_verification_no: parsed.data.ddsVerification, submitted_at: new Date().toISOString() };
  } else if (next === 'rejected') {
    update = { status: 'rejected' };
  } else {
    return { error: 'ship.errors.unknown' };
  }
  const { error } = await ctx.supabase.from('shipments').update(update).eq('organization_id', ctx.organizationId).eq('id', id);
  if (error) return { error: 'ship.errors.unknown' };
  revalidatePath(`/${locale}/app/shipments/${id}`);
  redirect({ href: `/app/shipments/${id}`, locale });
  return {};
}

const RISK_TEXT_MAX = 5000;

/** Record the risk assessment (art. 10) and mitigation (art. 11). Editing makes a ready shipment a draft again. */
export async function saveRiskAssessment(_prev: ShipmentFormState, formData: FormData): Promise<ShipmentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const id = str(formData, 'id');
  const assessment = str(formData, 'riskAssessment').trim();
  const mitigation = str(formData, 'riskMitigation').trim();
  const negligible = formData.get('riskNegligible') === 'on';
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return { error: 'ship.errors.unknown' };
  if (assessment.length > RISK_TEXT_MAX || mitigation.length > RISK_TEXT_MAX) return { error: 'ship.errors.riskTooLong' };
  if (negligible && !assessment) return { error: 'ship.errors.riskAssessment' };
  const { data: existing } = await ctx.supabase
    .from('shipments')
    .select('status, risk_assessment, risk_mitigation, risk_negligible')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();
  if (!existing) return { error: 'ship.errors.unknown' };
  if (existing.status === 'submitted') return { error: 'ship.locked' };
  const unchanged =
    (existing.risk_assessment ?? '') === assessment &&
    (existing.risk_mitigation ?? '') === mitigation &&
    existing.risk_negligible === (assessment ? negligible : null);
  if (unchanged) return { saved: true };
  const { error } = await ctx.supabase
    .from('shipments')
    .update({
      risk_assessment: assessment || null,
      risk_mitigation: mitigation || null,
      risk_negligible: assessment ? negligible : null,
      risk_assessed_at: assessment ? new Date().toISOString() : null,
      ...(existing.status === 'ready' ? { status: 'draft' as const } : {}),
    })
    .eq('organization_id', ctx.organizationId)
    .eq('id', id);
  if (error) return { error: 'ship.errors.unknown' };
  revalidatePath(`/${locale}/app/shipments/${id}`);
  return { saved: true };
}

/** New draft shipment with the same customer, products, plots and documents (fresh plot snapshots). */
export async function copyShipment(_prev: ShipmentFormState, formData: FormData): Promise<ShipmentFormState> {
  const locale = str(formData, 'locale') || 'sl';
  const id = str(formData, 'id');
  const ctx = await getPlotContext();
  if (!ctx || !UUID.test(id)) return { error: 'ship.errors.unknown' };
  const source = await getShipment(ctx.organizationId, id, locale);
  if (!source) return { error: 'ship.errors.unknown' };
  const { data: refs } = await ctx.supabase.from('shipments').select('internal_ref').eq('organization_id', ctx.organizationId).like('internal_ref', `${source.shipment.internal_ref}%`);
  const s = source.shipment;
  const { data, error } = await ctx.supabase
    .from('shipments')
    .insert({
      organization_id: ctx.organizationId,
      internal_ref: nextCopyRef(s.internal_ref, (refs ?? []).map((r) => r.internal_ref)),
      customer_id: s.customer_id,
      mode: s.mode,
      activity: s.activity,
      country_of_production: s.country_of_production,
      copied_from_id: s.id,
    })
    .select('id')
    .single();
  if (error || !data) return { error: 'ship.errors.unknown' };
  const ok = await writeChildren(ctx, data.id, {
    internalRef: '',
    customerId: null,
    shipmentDate: null,
    mode: s.mode,
    activity: s.activity,
    countryOfProduction: null,
    items: source.items.map((i) => ({ productId: i.productId, netMassKg: i.netMassKg, volumeM3: i.volumeM3, pieces: i.pieces })),
    plotIds: source.plots.map((p) => p.id),
    documentIds: source.documents.map((d) => d.id),
    references: [],
  });
  if (!ok) return { error: 'ship.errors.unknown' };
  revalidatePath(`/${locale}/app/shipments`);
  redirect({ href: `/app/shipments/${data.id}/edit`, locale });
  return {};
}
