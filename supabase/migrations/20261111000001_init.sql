-- LesTrace initial schema: organizations, plots, documents, shipments, buyer shares, audit log.
-- Every business table carries organization_id and is protected by RLS (members of the organization only).
-- Composite foreign keys (organization_id, x_id) make links across organizations impossible.
-- Non-cascading ones are DEFERRABLE INITIALLY DEFERRED so deleting a whole organization (cascade) succeeds,
-- while deleting e.g. a plot that a shipment still uses fails at commit.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.org_kind as enum ('operator', 'exporter', 'importer', 'trader');
create type public.org_size as enum ('micro', 'small', 'medium', 'large');
create type public.member_role as enum ('owner', 'member');
create type public.supplier_kind as enum ('forest_owner', 'company');
create type public.document_type as enum ('felling_permit', 'decision', 'delivery_note', 'certificate_fsc', 'certificate_pefc', 'other');
create type public.shipment_mode as enum ('submit_dds', 'forward_references');
create type public.shipment_activity as enum ('domestic', 'import', 'export');
create type public.shipment_status as enum ('draft', 'ready', 'submitted', 'rejected');
create type public.plot_status as enum ('valid', 'warning', 'error');
create type public.upstream_ref_kind as enum ('dds', 'simplified_declaration');
create type public.risk_level as enum ('low', 'standard', 'high');
create type public.link_status as enum ('pending', 'active', 'revoked');

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data (read-only for API roles)
-- ---------------------------------------------------------------------------
create table public.species (
  id smallint generated always as identity primary key,
  scientific_name text not null unique,
  common_name_sl text not null,
  common_name_hr text not null,
  common_name_sr text not null,
  common_name_bs text not null,
  common_name_en text not null
);

create table public.hs_codes (
  code text primary key check (code ~ '^[0-9]{2,10}$'),
  description_sl text not null,
  description_en text not null,
  in_scope boolean not null default true,
  applies_from date not null default date '2026-12-30',
  notes text
);

create table public.country_risk (
  country char(2) primary key check (country ~ '^[A-Z]{2}$'),
  risk public.risk_level not null,
  source_act text not null,
  valid_from date,
  notes text
);

-- ---------------------------------------------------------------------------
-- Organizations and membership
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  tax_id text,
  registration_no text,
  eori text,
  kind public.org_kind not null,
  size public.org_size not null,
  was_under_eutr boolean not null default false,
  address text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.member_role not null default 'member',
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (organization_id);

-- Membership helpers live in a schema that the Data API does not expose.
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.user_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m where m.user_id = (select auth.uid())
$$;

create function private.user_owner_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m where m.user_id = (select auth.uid()) and m.role = 'owner'
$$;

revoke all on function private.user_org_ids() from public, anon;
revoke all on function private.user_owner_org_ids() from public, anon;
grant execute on function private.user_org_ids() to authenticated;
grant execute on function private.user_owner_org_ids() to authenticated;

-- The creator of an organization becomes its owner.
create function private.add_creator_as_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    insert into public.memberships (organization_id, user_id, role) values (new.id, (select auth.uid()), 'owner');
  end if;
  return new;
end;
$$;
create trigger organizations_add_owner after insert on public.organizations
  for each row execute function private.add_creator_as_owner();

-- An organization always keeps at least one owner (unless the organization itself is deleted).
create function private.keep_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = old.organization_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'An organization must keep at least one owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger memberships_keep_last_owner before update or delete on public.memberships
  for each row execute function private.keep_last_owner();

-- ---------------------------------------------------------------------------
-- Suppliers, customers, products
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  kind public.supplier_kind not null,
  tax_id text,
  address text,
  email text,
  simplified_declaration_id text,
  linked_organization_id uuid references public.organizations (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

-- Supplier ↔ buyer relation between two organizations (importer portal, phase 3).
create table public.organization_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  partner_organization_id uuid not null references public.organizations (id) on delete cascade,
  status public.link_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, partner_organization_id),
  check (organization_id <> partner_organization_id)
);
create index organization_links_partner_idx on public.organization_links (partner_organization_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  address text,
  email text,
  eori text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  hs_code text not null references public.hs_codes (code),
  species_id smallint references public.species (id),
  trade_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

-- ---------------------------------------------------------------------------
-- Plots and documents
-- ---------------------------------------------------------------------------
create table public.plot_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  detected_crs text,
  feature_count integer not null default 0 check (feature_count >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.plots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid,
  label text not null check (length(trim(label)) > 0),
  cadastral_no text,
  cadastral_municipality text,
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  geom extensions.geometry(Geometry, 4326)
    check (geom is null or extensions.geometrytype(geom) in ('POINT', 'MULTIPOINT', 'POLYGON', 'MULTIPOLYGON')),
  postal_address text,
  area_ha numeric(12, 4) check (area_ha is null or area_ha >= 0),
  area_source text check (area_source in ('computed', 'declared')),
  validation_status public.plot_status not null,
  validation_issues jsonb not null default '[]'::jsonb,
  source_import_id uuid,
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, supplier_id) references public.suppliers (organization_id, id) deferrable initially deferred,
  foreign key (organization_id, source_import_id) references public.plot_imports (organization_id, id) deferrable initially deferred,
  check (geom is not null or postal_address is not null or validation_status <> 'valid')
);
create index plots_geom_idx on public.plots using gist (geom);
create index plots_org_status_idx on public.plots (organization_id, validation_status);
create index plots_org_label_idx on public.plots (organization_id, label);
create index plots_supplier_idx on public.plots (organization_id, supplier_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.document_type not null,
  title text not null check (length(trim(title)) > 0),
  file_path text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  valid_from date,
  valid_to date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index documents_org_valid_to_idx on public.documents (organization_id, valid_to);

create table public.plot_documents (
  organization_id uuid not null,
  plot_id uuid not null,
  document_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (plot_id, document_id),
  foreign key (organization_id, plot_id) references public.plots (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
create index plot_documents_org_doc_idx on public.plot_documents (organization_id, document_id);

-- ---------------------------------------------------------------------------
-- Shipments
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  internal_ref text not null check (length(trim(internal_ref)) > 0),
  customer_id uuid,
  mode public.shipment_mode not null,
  activity public.shipment_activity not null,
  shipment_date date,
  country_of_production char(2) check (country_of_production ~ '^[A-Z]{2}$'),
  status public.shipment_status not null default 'draft',
  dds_reference_no text,
  dds_verification_no text,
  submitted_at timestamptz,
  copied_from_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) deferrable initially deferred,
  foreign key (organization_id, copied_from_id) references public.shipments (organization_id, id) on delete set null (copied_from_id)
);
create index shipments_org_status_idx on public.shipments (organization_id, status);
create index shipments_org_customer_idx on public.shipments (organization_id, customer_id);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shipment_id uuid not null,
  product_id uuid not null,
  net_mass_kg numeric(14, 3) check (net_mass_kg is null or net_mass_kg >= 0),
  volume_m3 numeric(14, 3) check (volume_m3 is null or volume_m3 >= 0),
  supplementary_units numeric(14, 3) check (supplementary_units is null or supplementary_units >= 0),
  pieces integer check (pieces is null or pieces >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shipment_id) references public.shipments (organization_id, id) on delete cascade,
  foreign key (organization_id, product_id) references public.products (organization_id, id) deferrable initially deferred
);
create index shipment_items_shipment_idx on public.shipment_items (organization_id, shipment_id);
create index shipment_items_product_idx on public.shipment_items (organization_id, product_id);

create table public.shipment_plots (
  organization_id uuid not null,
  shipment_id uuid not null,
  plot_id uuid not null,
  -- Geometry at the time the shipment was prepared; later plot edits do not change a sent shipment.
  geom_snapshot extensions.geometry(Geometry, 4326),
  created_at timestamptz not null default now(),
  primary key (shipment_id, plot_id),
  foreign key (organization_id, shipment_id) references public.shipments (organization_id, id) on delete cascade,
  foreign key (organization_id, plot_id) references public.plots (organization_id, id) deferrable initially deferred
);
create index shipment_plots_plot_idx on public.shipment_plots (organization_id, plot_id);

create table public.shipment_documents (
  organization_id uuid not null,
  shipment_id uuid not null,
  document_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (shipment_id, document_id),
  foreign key (organization_id, shipment_id) references public.shipments (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) deferrable initially deferred
);
create index shipment_documents_doc_idx on public.shipment_documents (organization_id, document_id);

-- DDS reference numbers / simplified declaration ids received from suppliers (Regulation 2025/2650).
create table public.upstream_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shipment_id uuid not null,
  supplier_id uuid,
  kind public.upstream_ref_kind not null,
  reference_no text not null check (length(trim(reference_no)) > 0),
  verification_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shipment_id) references public.shipments (organization_id, id) on delete cascade,
  foreign key (organization_id, supplier_id) references public.suppliers (organization_id, id) deferrable initially deferred
);
create index upstream_references_shipment_idx on public.upstream_references (organization_id, shipment_id);
create index upstream_references_supplier_idx on public.upstream_references (organization_id, supplier_id);

-- Public buyer package links. Only the SHA-256 of the token is stored; the server reads it with the service key.
create table public.buyer_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  shipment_ids uuid[] not null check (cardinality(shipment_ids) > 0),
  include_documents boolean not null default true,
  last_viewed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index buyer_shares_org_idx on public.buyer_shares (organization_id);

-- ---------------------------------------------------------------------------
-- Audit log (append-only, kept ≥ 5 years; no FK so it survives deletion of the organization)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  actor_id uuid,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  at timestamptz not null default now()
);
create index audit_log_org_at_idx on public.audit_log (organization_id, at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  j jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (organization_id, actor_id, table_name, row_id, action, old_data, new_data)
  values (
    (case when tg_table_name = 'organizations' then j ->> 'id' else j ->> 'organization_id' end)::uuid,
    (select auth.uid()),
    tg_table_name,
    coalesce(j ->> 'id', concat_ws(':', j ->> 'shipment_id', j ->> 'plot_id', j ->> 'document_id', j ->> 'user_id')),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + audit
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['organizations', 'suppliers', 'organization_links', 'customers', 'products', 'plots',
                           'documents', 'shipments', 'shipment_items', 'upstream_references', 'buyer_shares'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
  foreach t in array array['organizations', 'memberships', 'invitations', 'suppliers', 'organization_links', 'customers',
                           'products', 'plot_imports', 'plots', 'documents', 'plot_documents', 'shipments', 'shipment_items',
                           'shipment_plots', 'shipment_documents', 'upstream_references', 'buyer_shares'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.species enable row level security;
alter table public.hs_codes enable row level security;
alter table public.country_risk enable row level security;
create policy species_read on public.species for select to anon, authenticated using (true);
create policy hs_codes_read on public.hs_codes for select to anon, authenticated using (true);
create policy country_risk_read on public.country_risk for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.species, public.hs_codes, public.country_risk from anon, authenticated;

alter table public.organizations enable row level security;
create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.user_org_ids()) or created_by = (select auth.uid()));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy organizations_update on public.organizations for update to authenticated
  using (id in (select private.user_owner_org_ids())) with check (id in (select private.user_owner_org_ids()));
create policy organizations_delete on public.organizations for delete to authenticated
  using (id in (select private.user_owner_org_ids()));

alter table public.memberships enable row level security;
create policy memberships_select on public.memberships for select to authenticated
  using (organization_id in (select private.user_org_ids()));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (organization_id in (select private.user_owner_org_ids()));
create policy memberships_update on public.memberships for update to authenticated
  using (organization_id in (select private.user_owner_org_ids()))
  with check (organization_id in (select private.user_owner_org_ids()));
create policy memberships_delete on public.memberships for delete to authenticated
  using (organization_id in (select private.user_owner_org_ids()));

alter table public.invitations enable row level security;
create policy invitations_owner on public.invitations for all to authenticated
  using (organization_id in (select private.user_owner_org_ids()))
  with check (organization_id in (select private.user_owner_org_ids()));

alter table public.organization_links enable row level security;
create policy organization_links_select on public.organization_links for select to authenticated
  using (organization_id in (select private.user_org_ids()) or partner_organization_id in (select private.user_org_ids()));
create policy organization_links_insert on public.organization_links for insert to authenticated
  with check (organization_id in (select private.user_org_ids()));
create policy organization_links_update on public.organization_links for update to authenticated
  using (organization_id in (select private.user_org_ids())) with check (organization_id in (select private.user_org_ids()));
create policy organization_links_delete on public.organization_links for delete to authenticated
  using (organization_id in (select private.user_org_ids()));

-- Standard tenant policy: members of the organization can read and write its rows.
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'customers', 'products', 'plot_imports', 'plots', 'documents', 'plot_documents',
                           'shipments', 'shipment_items', 'shipment_plots', 'shipment_documents', 'upstream_references',
                           'buyer_shares'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id in (select private.user_org_ids()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id in (select private.user_org_ids()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id in (select private.user_org_ids())) with check (organization_id in (select private.user_org_ids()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (organization_id in (select private.user_org_ids()))', t || '_delete', t);
  end loop;
end;
$$;

alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select to authenticated
  using (organization_id in (select private.user_org_ids()));
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated, service_role;
