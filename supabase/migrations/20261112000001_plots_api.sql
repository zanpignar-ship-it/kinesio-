-- Plot read helpers for the app (RLS applies: security invoker) and a private bucket for original import files.

-- All non-archived plots of an organization as one simplified GeoJSON FeatureCollection (for the map).
create function public.plots_map(p_org uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'id', p.id,
        'properties', jsonb_build_object('id', p.id, 'label', p.label, 'validation_status', p.validation_status),
        'geometry', extensions.st_asgeojson(extensions.st_simplifypreservetopology(p.geom, 0.00001), 6)::jsonb
      ) order by p.label
    ), '[]'::jsonb)
  )
  from public.plots p
  where p.organization_id = p_org and p.archived_at is null and p.geom is not null
$$;

-- Plots whose bounding box intersects the given box (candidates for duplicate detection).
create function public.plots_in_bbox(
  p_org uuid, p_minx float8, p_miny float8, p_maxx float8, p_maxy float8, p_exclude uuid default null
) returns table (id uuid, geom jsonb)
language sql stable security invoker set search_path = '' as $$
  select p.id, extensions.st_asgeojson(p.geom, 8)::jsonb
  from public.plots p
  where p.organization_id = p_org
    and p.archived_at is null
    and p.geom is not null
    and p.geom operator(extensions.&&) extensions.st_makeenvelope(p_minx, p_miny, p_maxx, p_maxy, 4326)
    and (p_exclude is null or p.id <> p_exclude)
  limit 500
$$;

revoke all on function public.plots_map(uuid) from public, anon;
revoke all on function public.plots_in_bbox(uuid, float8, float8, float8, float8, uuid) from public, anon;
grant execute on function public.plots_map(uuid) to authenticated;
grant execute on function public.plots_in_bbox(uuid, float8, float8, float8, float8, uuid) to authenticated;

-- Original files of plot imports (kept for inspections). Path: "<organization_id>/<import_id>/<file name>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plot-imports', 'plot-imports', false, 52428800, array[
  'application/geo+json', 'application/json', 'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz',
  'application/zip', 'application/x-zip-compressed', 'text/csv', 'text/plain', 'application/octet-stream'
])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy plot_imports_select on storage.objects for select to authenticated
  using (bucket_id = 'plot-imports' and private.path_org_id(name) in (select private.user_org_ids()));
create policy plot_imports_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'plot-imports' and private.path_org_id(name) in (select private.user_org_ids()));
create policy plot_imports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'plot-imports' and private.path_org_id(name) in (select private.user_org_ids()));
