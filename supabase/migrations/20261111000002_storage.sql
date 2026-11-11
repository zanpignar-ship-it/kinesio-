-- Private bucket for permits, decisions, delivery notes and certificates.
-- Object path: "<organization_id>/<document_id>/<file name>"; only members of that organization can access it.
-- Files are served to people through short-lived signed URLs created on the server.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- First path segment as uuid, or null when it is not a uuid (such paths are then rejected by the policies).
create function private.path_org_id(object_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return folder::uuid;
  end if;
  return null;
end;
$$;
grant execute on function private.path_org_id(text) to authenticated;

create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.path_org_id(name) in (select private.user_org_ids()));
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.path_org_id(name) in (select private.user_org_ids()));
create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and private.path_org_id(name) in (select private.user_org_ids()))
  with check (bucket_id = 'documents' and private.path_org_id(name) in (select private.user_org_ids()));
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and private.path_org_id(name) in (select private.user_org_ids()));
