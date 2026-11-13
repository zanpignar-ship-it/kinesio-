-- Supplier portal: a supplier (forest owner, company) opens a link without an account, adds plots and uploads
-- permits. Only the SHA-256 of the link token is stored. All writes go through security definer functions that
-- check the token; plots arrive with status "warning" and the issue SUPPLIER_SUBMITTED until the app validates them.

create table public.supplier_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, supplier_id) references public.suppliers (organization_id, id) on delete cascade
);
create index supplier_links_supplier_idx on public.supplier_links (organization_id, supplier_id);
alter table public.supplier_links enable row level security;
create policy supplier_links_select on public.supplier_links for select to authenticated
  using (organization_id in (select private.user_org_ids()));
create policy supplier_links_insert on public.supplier_links for insert to authenticated
  with check (organization_id in (select private.user_org_ids()));
create policy supplier_links_update on public.supplier_links for update to authenticated
  using (organization_id in (select private.user_org_ids())) with check (organization_id in (select private.user_org_ids()));
create trigger supplier_links_audit after insert or update or delete on public.supplier_links
  for each row execute function private.audit_row();

-- Revoking is final; links cannot be extended.
create function private.supplier_link_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'A revoked link cannot be restored' using errcode = 'P0001';
  end if;
  if new.expires_at > old.expires_at then
    raise exception 'A link cannot be extended; create a new one' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger supplier_links_guard before update on public.supplier_links
  for each row execute function private.supplier_link_guard();

alter table public.plots add column submitted_via_link uuid references public.supplier_links (id) on delete set null;
alter table public.documents add column submitted_via_link uuid references public.supplier_links (id) on delete set null;

-- The valid link for a token, or null.
create function private.supplier_link_for(p_token text) returns public.supplier_links
language sql stable security definer set search_path = '' as $$
  select l.* from public.supplier_links l
  where p_token is not null and length(p_token) >= 32
    and l.token_hash = extensions.digest(p_token, 'sha256') and l.revoked_at is null and l.expires_at > now()
$$;
revoke all on function private.supplier_link_for(text) from public, anon, authenticated;

-- What the supplier sees: whose portal it is and the supplier's own plots and documents (nothing else).
create function public.supplier_portal_info(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.supplier_links;
begin
  l := private.supplier_link_for(p_token);
  if l.id is null then
    return null;
  end if;
  update public.supplier_links set last_used_at = now() where id = l.id and (last_used_at is null or last_used_at < now() - interval '1 hour');
  return jsonb_build_object(
    'link_id', l.id,
    'organization_id', l.organization_id,
    'expires_at', l.expires_at,
    'organization', (select o.name from public.organizations o where o.id = l.organization_id),
    'supplier', (select s.name from public.suppliers s where s.id = l.supplier_id),
    'country', (select s.country from public.suppliers s where s.id = l.supplier_id),
    'plots', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'country', p.country, 'area_ha', p.area_ha,
        'harvest_from', p.harvest_from, 'harvest_to', p.harvest_to, 'validation_status', p.validation_status,
        'geometry', extensions.st_asgeojson(p.geom, 6)::jsonb) order by p.label)
      from public.plots p
      where p.organization_id = l.organization_id and p.supplier_id = l.supplier_id and p.archived_at is null), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'type', d.type, 'valid_to', d.valid_to) order by d.created_at desc)
      from public.documents d
      where d.organization_id = l.organization_id and d.submitted_via_link in (
        select x.id from public.supplier_links x where x.organization_id = l.organization_id and x.supplier_id = l.supplier_id)), '[]'::jsonb)
  );
end;
$$;

create function public.supplier_portal_add_plot(
  p_token text, p_label text, p_geometry jsonb, p_area_ha numeric, p_harvest_from date, p_harvest_to date
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.supplier_links;
  g extensions.geometry;
  v_country char(2);
  v_id uuid;
begin
  l := private.supplier_link_for(p_token);
  if l.id is null then
    raise exception 'Link not valid' using errcode = 'P0001', hint = 'LT_LINK_INVALID';
  end if;
  if p_label is null or length(trim(p_label)) = 0 or length(p_label) > 120 then
    raise exception 'Label required' using errcode = 'P0001', hint = 'LT_LABEL';
  end if;
  if (select count(*) from public.plots p where p.submitted_via_link = l.id) >= 2000 then
    raise exception 'Too many plots' using errcode = 'P0001', hint = 'LT_TOO_MANY';
  end if;
  begin
    g := extensions.st_setsrid(extensions.st_geomfromgeojson(p_geometry::text), 4326);
  exception when others then
    raise exception 'Invalid geometry' using errcode = 'P0001', hint = 'LT_GEOMETRY';
  end;
  if extensions.geometrytype(g) not in ('POINT', 'MULTIPOINT', 'POLYGON', 'MULTIPOLYGON') then
    raise exception 'Invalid geometry' using errcode = 'P0001', hint = 'LT_GEOMETRY';
  end if;
  select s.country into v_country from public.suppliers s where s.id = l.supplier_id;
  insert into public.plots (organization_id, supplier_id, label, country, geom, area_ha, area_source, harvest_from, harvest_to,
                            validation_status, validation_issues, submitted_via_link, created_by)
  values (l.organization_id, l.supplier_id, trim(p_label), v_country, g,
          case when p_area_ha > 0 and p_area_ha <= 100000 then p_area_ha end,
          case when p_area_ha > 0 and p_area_ha <= 100000 then 'declared' end,
          p_harvest_from, case when p_harvest_to >= coalesce(p_harvest_from, p_harvest_to) then p_harvest_to end,
          'warning', '[{"code":"SUPPLIER_SUBMITTED","severity":"warning"}]'::jsonb, l.id, null)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.supplier_portal_add_document(
  p_token text, p_title text, p_type public.document_type, p_valid_from date, p_valid_to date,
  p_file_path text, p_mime text, p_size bigint, p_plot_ids uuid[]
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.supplier_links;
  v_id uuid;
begin
  l := private.supplier_link_for(p_token);
  if l.id is null then
    raise exception 'Link not valid' using errcode = 'P0001', hint = 'LT_LINK_INVALID';
  end if;
  if p_title is null or length(trim(p_title)) = 0 or length(p_title) > 200 then
    raise exception 'Title required' using errcode = 'P0001', hint = 'LT_TITLE';
  end if;
  -- Only files uploaded into this link's own folder.
  if p_file_path is null or p_file_path not like l.organization_id::text || '/portal-' || l.id::text || '/%' or p_file_path like '%..%' then
    raise exception 'Bad file path' using errcode = 'P0001', hint = 'LT_FILE';
  end if;
  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp') or p_size <= 0 or p_size > 20971520 then
    raise exception 'Bad file' using errcode = 'P0001', hint = 'LT_FILE';
  end if;
  insert into public.documents (organization_id, type, title, file_path, mime, size_bytes, valid_from, valid_to, submitted_via_link, created_by)
  values (l.organization_id, p_type, trim(p_title), p_file_path, p_mime, p_size, p_valid_from,
          case when p_valid_to >= coalesce(p_valid_from, p_valid_to) then p_valid_to end, l.id, null)
  returning id into v_id;
  -- Links only to this supplier's plots.
  insert into public.plot_documents (organization_id, plot_id, document_id)
  select l.organization_id, p.id, v_id from public.plots p
  where p.organization_id = l.organization_id and p.supplier_id = l.supplier_id and p.id = any (coalesce(p_plot_ids, '{}'));
  return v_id;
end;
$$;

revoke all on function public.supplier_portal_info(text) from public;
revoke all on function public.supplier_portal_add_plot(text, text, jsonb, numeric, date, date) from public;
revoke all on function public.supplier_portal_add_document(text, text, public.document_type, date, date, text, text, bigint, uuid[]) from public;
grant execute on function public.supplier_portal_info(text) to anon, authenticated;
grant execute on function public.supplier_portal_add_plot(text, text, jsonb, numeric, date, date) to anon, authenticated;
grant execute on function public.supplier_portal_add_document(text, text, public.document_type, date, date, text, text, bigint, uuid[]) to anon, authenticated;

-- Uploads from the portal: only into "<organization>/portal-<link id>/..." of a valid link.
create function private.portal_upload_allowed(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  f text[] := storage.foldername(object_name);
begin
  if array_length(f, 1) < 2 or f[2] !~* '^portal-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.supplier_links l
    where l.id = substring(f[2] from 8)::uuid and l.organization_id::text = f[1] and l.revoked_at is null and l.expires_at > now()
  );
end;
$$;
revoke all on function private.portal_upload_allowed(text) from public;
grant usage on schema private to anon;
grant execute on function private.portal_upload_allowed(text) to anon;
create policy documents_portal_insert on storage.objects for insert to anon
  with check (bucket_id = 'documents' and private.portal_upload_allowed(name));
