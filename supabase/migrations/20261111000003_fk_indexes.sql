-- Covering indexes for composite foreign keys used by cascades and joins (Supabase performance advisor 0001).
-- created_by → auth.users foreign keys stay unindexed on purpose: users are deleted rarely.
create index plot_documents_org_plot_idx on public.plot_documents (organization_id, plot_id);
create index shipment_documents_org_shipment_idx on public.shipment_documents (organization_id, shipment_id);
create index shipment_plots_org_shipment_idx on public.shipment_plots (organization_id, shipment_id);
create index plots_org_import_idx on public.plots (organization_id, source_import_id);
create index shipments_org_copied_from_idx on public.shipments (organization_id, copied_from_id);
