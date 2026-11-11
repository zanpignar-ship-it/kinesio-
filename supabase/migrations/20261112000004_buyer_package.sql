-- Public buyer package: anyone with a valid share token (not expired, not revoked) can read the shared shipments.
-- Only the SHA-256 of the token is stored; this function is the only way anonymous visitors reach the data.
create function public.buyer_package(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_share public.buyer_shares;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_share from public.buyer_shares s
  where s.token_hash = extensions.digest(p_token, 'sha256') and s.revoked_at is null and s.expires_at > now();
  if not found then
    return null;
  end if;

  update public.buyer_shares set last_viewed_at = now() where id = v_share.id;

  select jsonb_build_object(
    'expires_at', v_share.expires_at,
    'include_documents', v_share.include_documents,
    'organization', (select jsonb_build_object('name', o.name, 'country', o.country, 'tax_id', o.tax_id, 'registration_no', o.registration_no, 'eori', o.eori, 'address', o.address)
                     from public.organizations o where o.id = v_share.organization_id),
    'shipments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'internal_ref', s.internal_ref,
        'shipment_date', s.shipment_date,
        'status', s.status,
        'activity', s.activity,
        'country_of_production', s.country_of_production,
        'dds_reference_no', s.dds_reference_no,
        'dds_verification_no', s.dds_verification_no,
        'customer', (select c.name from public.customers c where c.id = s.customer_id),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product', p.name, 'hs_code', p.hs_code, 'trade_name', p.trade_name, 'scientific_name', sp.scientific_name,
            'net_mass_kg', i.net_mass_kg, 'volume_m3', i.volume_m3, 'pieces', i.pieces) order by p.name)
          from public.shipment_items i join public.products p on p.id = i.product_id left join public.species sp on sp.id = p.species_id
          where i.shipment_id = s.id), '[]'::jsonb),
        'plots', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', pl.label, 'country', pl.country, 'area_ha', pl.area_ha,
            'geometry', extensions.st_asgeojson(sp2.geom_snapshot, 6)::jsonb) order by pl.label)
          from public.shipment_plots sp2 join public.plots pl on pl.id = sp2.plot_id
          where sp2.shipment_id = s.id and sp2.geom_snapshot is not null), '[]'::jsonb),
        'documents', case when v_share.include_documents then coalesce((
          select jsonb_agg(jsonb_build_object('title', d.title, 'type', d.type, 'valid_from', d.valid_from, 'valid_to', d.valid_to) order by d.title)
          from public.shipment_documents sd join public.documents d on d.id = sd.document_id
          where sd.shipment_id = s.id), '[]'::jsonb) else '[]'::jsonb end
      ) order by s.internal_ref)
      from public.shipments s
      where s.organization_id = v_share.organization_id and s.id = any (v_share.shipment_ids)), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.buyer_package(text) from public;
grant execute on function public.buyer_package(text) to anon, authenticated;
