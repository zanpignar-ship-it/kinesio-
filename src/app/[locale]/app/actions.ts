'use server';

import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { ORG_COOKIE } from '@/lib/auth/pick-organization';
import { getMemberships, getSessionUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/lib/db/database.types';
import { SAMPLE } from '@/lib/demo/sample';
import { getPlotContext } from '@/lib/plots/context';
import { prepareDrawnPlot } from '@/lib/plots/service';

export async function switchOrganization(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'sl');
  const orgId = String(formData.get('organizationId') ?? '');
  const user = await getSessionUser();
  if (user && (await getMemberships(user.id)).some((m) => m.organization.id === orgId)) {
    (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  redirect({ href: '/app', locale });
}

/** One-click sample (supplier, two plots, product, customer, draft shipment) for organizations that have no plots yet. */
export async function loadSampleData(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'sl');
  const ctx = await getPlotContext();
  if (!ctx) return;
  const { supabase, organizationId: org } = ctx;
  const { count } = await supabase.from('plots').select('id', { count: 'exact', head: true }).eq('organization_id', org);
  if (count) return;
  const { data: supplier } = await supabase.from('suppliers').insert({ organization_id: org, ...SAMPLE.supplier }).select('id').single();
  if (!supplier) return;
  const plotRows = SAMPLE.plots.map((p) => {
    const prepared = prepareDrawnPlot(
      { label: p.label, country: 'SI', geometry: p.geometry, declaredAreaHa: 'declaredAreaHa' in p ? p.declaredAreaHa : undefined, cadastralNo: p.cadastralNo, cadastralMunicipality: p.cadastralMunicipality },
      [],
    );
    return {
      ...prepared,
      geom: prepared.geom as unknown as string | null,
      validation_issues: prepared.validation_issues as unknown as Json,
      organization_id: org,
      supplier_id: supplier.id,
      harvest_from: p.harvestFrom,
      harvest_to: p.harvestTo,
    };
  });
  const { data: plots } = await supabase.from('plots').insert(plotRows).select('id');
  const { data: species } = await supabase.from('species').select('id').eq('scientific_name', SAMPLE.product.species).maybeSingle();
  const { data: product } = await supabase
    .from('products')
    .insert({ organization_id: org, name: SAMPLE.product.name, hs_code: SAMPLE.product.hsCode, species_id: species?.id ?? null, trade_name: SAMPLE.product.tradeName })
    .select('id')
    .single();
  const { data: customer } = await supabase.from('customers').insert({ organization_id: org, ...SAMPLE.customer }).select('id').single();
  const { data: shipment } = await supabase
    .from('shipments')
    .insert({ organization_id: org, internal_ref: SAMPLE.shipment.internalRef, customer_id: customer?.id ?? null, mode: 'submit_dds', activity: SAMPLE.shipment.activity, country_of_production: 'SI' })
    .select('id')
    .single();
  if (shipment && product && plots) {
    await supabase.rpc('save_shipment_children', {
      p_shipment: shipment.id,
      p_items: [{ productId: product.id, netMassKg: SAMPLE.shipment.netMassKg }] as never,
      p_plot_ids: plots.map((p) => p.id),
      p_document_ids: [],
      p_references: [] as never,
    });
  }
  revalidatePath(`/${locale}/app`, 'layout');
  redirect({ href: shipment ? `/app/shipments/${shipment.id}` : '/app', locale });
}

/** Remove the sample (only records created by loadSampleData, recognised by their "Primer:" names and PRIMER-1). */
export async function deleteSampleData(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'sl');
  const ctx = await getPlotContext();
  if (!ctx) return;
  const { supabase, organizationId: org } = ctx;
  await supabase.from('shipments').delete().eq('organization_id', org).eq('internal_ref', SAMPLE.shipment.internalRef).neq('status', 'submitted');
  await supabase.from('plots').delete().eq('organization_id', org).in('label', SAMPLE.plots.map((p) => p.label));
  await supabase.from('products').delete().eq('organization_id', org).eq('name', SAMPLE.product.name);
  await supabase.from('customers').delete().eq('organization_id', org).eq('name', SAMPLE.customer.name);
  await supabase.from('suppliers').delete().eq('organization_id', org).eq('name', SAMPLE.supplier.name);
  revalidatePath(`/${locale}/app`, 'layout');
  redirect({ href: '/app', locale });
}
