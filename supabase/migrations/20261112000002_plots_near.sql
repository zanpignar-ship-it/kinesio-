-- Existing plots near each of the given geometries (duplicate detection for imports).
-- One envelope per geometry (padded ~50 m) instead of one box around the whole file, and no row limit.
create function public.plots_near(p_org uuid, p_geoms jsonb) returns table (id uuid, geom jsonb)
language sql stable security invoker set search_path = '' as $$
  select distinct on (p.id) p.id, extensions.st_asgeojson(p.geom, 8)::jsonb
  from public.plots p
  join jsonb_array_elements(p_geoms) g
    on p.geom operator(extensions.&&) extensions.st_expand(
         extensions.st_envelope(extensions.st_setsrid(extensions.st_geomfromgeojson(g::text), 4326)), 0.0005)
  where p.organization_id = p_org and p.archived_at is null and p.geom is not null
  order by p.id
$$;
revoke all on function public.plots_near(uuid, jsonb) from public, anon;
grant execute on function public.plots_near(uuid, jsonb) to authenticated;
