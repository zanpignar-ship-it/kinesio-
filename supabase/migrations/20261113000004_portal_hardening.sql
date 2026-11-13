-- Security review fixes (2026-11-13) for the buyer document downloads and the supplier portal.

-- 1. A document's file must live in its own organization's folder (so no one can point a document at another
--    organization's file and download it through their own share). NOT VALID: checked for new and changed rows.
alter table public.documents add constraint documents_file_in_own_folder
  check (split_part(file_path, '/', 1) = organization_id::text) not valid;

-- 2+3. Grants tied to the share (stop at revocation), one row per file (no unbounded growth).
create table private.buyer_file_grants (
  object_name text primary key,
  share_id uuid not null references public.buyer_shares (id) on delete cascade,
  expires_at timestamptz not null
);

create or replace function public.buyer_document_access(p_token text, p_document_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_share public.buyer_shares;
  v_doc public.documents;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_share from public.buyer_shares s
  where s.token_hash = extensions.digest(p_token, 'sha256') and s.revoked_at is null and s.expires_at > now() and s.include_documents;
  if not found then
    return null;
  end if;
  select d.* into v_doc from public.documents d
  join public.shipment_documents sd on sd.document_id = d.id
  where d.id = p_document_id and d.organization_id = v_share.organization_id and sd.shipment_id = any (v_share.shipment_ids)
    and split_part(d.file_path, '/', 1) = v_share.organization_id::text
  limit 1;
  if not found then
    return null;
  end if;
  insert into private.buyer_file_grants (object_name, share_id, expires_at)
  values (v_doc.file_path, v_share.id, now() + interval '5 minutes')
  on conflict (object_name) do update set share_id = excluded.share_id, expires_at = excluded.expires_at
    where private.buyer_file_grants.expires_at < now() + interval '4 minutes';
  return jsonb_build_object('path', v_doc.file_path, 'title', v_doc.title, 'mime', v_doc.mime);
end;
$$;

create or replace function private.buyer_grant_allows(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.buyer_file_grants g
    join public.buyer_shares s on s.id = g.share_id
    where g.object_name = $1 and g.expires_at > now() and s.revoked_at is null and s.expires_at > now()
      and split_part($1, '/', 1) = s.organization_id::text
  )
$$;

-- 4+5. Portal limits: plots and documents per link, uploads per link, geometry size; lock the link while counting.
create index if not exists plots_submitted_via_link_idx on public.plots (submitted_via_link) where submitted_via_link is not null;
create index if not exists documents_submitted_via_link_idx on public.documents (submitted_via_link) where submitted_via_link is not null;

create or replace function public.supplier_portal_add_plot(
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
  perform 1 from public.supplier_links x where x.id = l.id for update;
  if p_label is null or length(trim(p_label)) = 0 or length(p_label) > 120 then
    raise exception 'Label required' using errcode = 'P0001', hint = 'LT_LABEL';
  end if;
  if p_geometry is null or length(p_geometry::text) > 1000000 then
    raise exception 'Invalid geometry' using errcode = 'P0001', hint = 'LT_GEOMETRY';
  end if;
  if (select count(*) from public.plots p where p.submitted_via_link = l.id) >= 2000 then
    raise exception 'Too many plots' using errcode = 'P0001', hint = 'LT_TOO_MANY';
  end if;
  begin
    g := extensions.st_setsrid(extensions.st_geomfromgeojson(p_geometry::text), 4326);
  exception when others then
    raise exception 'Invalid geometry' using errcode = 'P0001', hint = 'LT_GEOMETRY';
  end;
  if extensions.geometrytype(g) not in ('POINT', 'MULTIPOINT', 'POLYGON', 'MULTIPOLYGON') or extensions.st_npoints(g) > 50000 then
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

create or replace function public.supplier_portal_add_document(
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
  perform 1 from public.supplier_links x where x.id = l.id for update;
  if (select count(*) from public.documents d where d.submitted_via_link = l.id) >= 500 then
    raise exception 'Too many documents' using errcode = 'P0001', hint = 'LT_TOO_MANY';
  end if;
  if p_title is null or length(trim(p_title)) = 0 or length(p_title) > 200 then
    raise exception 'Title required' using errcode = 'P0001', hint = 'LT_TITLE';
  end if;
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
  insert into public.plot_documents (organization_id, plot_id, document_id)
  select l.organization_id, p.id, v_id from public.plots p
  where p.organization_id = l.organization_id and p.supplier_id = l.supplier_id and p.id = any (coalesce(p_plot_ids, '{}'));
  return v_id;
end;
$$;

-- At most 600 uploaded files per link.
create or replace function private.portal_upload_allowed(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  f text[] := storage.foldername(object_name);
begin
  if array_length(f, 1) < 2 or f[2] !~* '^portal-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if not exists (
    select 1 from public.supplier_links l
    where l.id = substring(f[2] from 8)::uuid and l.organization_id::text = f[1] and l.revoked_at is null and l.expires_at > now()
  ) then
    return false;
  end if;
  return (select count(*) from storage.objects o where o.bucket_id = 'documents' and o.name like f[1] || '/' || f[2] || '/%') < 600;
end;
$$;

-- 6. Links: at most a year, and token, supplier and organization cannot be changed afterwards.
alter table public.supplier_links add constraint supplier_links_max_validity check (expires_at <= created_at + interval '366 days') not valid;
create or replace function private.supplier_link_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'A revoked link cannot be restored' using errcode = 'P0001';
  end if;
  if new.expires_at > old.expires_at then
    raise exception 'A link cannot be extended; create a new one' using errcode = 'P0001';
  end if;
  if new.token_hash is distinct from old.token_hash or new.supplier_id is distinct from old.supplier_id
     or new.organization_id is distinct from old.organization_id or new.created_at is distinct from old.created_at then
    raise exception 'Only revocation is allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
