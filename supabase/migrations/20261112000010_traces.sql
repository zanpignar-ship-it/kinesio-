-- Direct submission to the EUDR Information System (TRACES, API V4).
-- Credentials per organization: only owners can read or change them; the authentication key is stored
-- encrypted by the application (AES-256-GCM, key in the server environment), never in plain text.
create table public.traces_credentials (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  environment text not null check (environment in ('acceptance', 'production')),
  username text not null check (length(trim(username)) between 1 and 200),
  client_id text not null check (length(trim(client_id)) between 1 and 100),
  auth_key_enc text not null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.traces_credentials enable row level security;
create policy traces_credentials_owner on public.traces_credentials for all to authenticated
  using (organization_id in (select private.user_owner_org_ids()))
  with check (organization_id in (select private.user_owner_org_ids()));
create trigger traces_credentials_updated_at before update on public.traces_credentials
  for each row execute function public.set_updated_at();

-- Submission state of a shipment in TRACES.
alter table public.shipments
  add column traces_uuid text check (traces_uuid is null or traces_uuid ~ '^[0-9a-fA-F-]{36}$'),
  add column traces_environment text check (traces_environment is null or traces_environment in ('acceptance', 'production')),
  add column traces_status text,
  add column traces_message text,
  add column traces_submitted_at timestamptz,
  add column traces_checked_at timestamptz;
