-- RENTORA core schema (Phase 1): identity, tenancy, inventory, CRM, reservations.
-- Runs as the schema owner. The application connects as role `rentora_app`,
-- which is subject to row-level security (RLS) on every tenant table.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Tenant context helpers. The app sets these per transaction with
-- set_config(..., true) so they can never leak across pooled connections.
-- ---------------------------------------------------------------------------
create or replace function app_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

create or replace function app_is_platform_admin() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.platform_admin', true), '') = 'on'
$$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identity (global, not tenant-scoped; only reachable through server code)
-- ---------------------------------------------------------------------------
create table users (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  password_hash     text not null,
  full_name         text not null check (length(full_name) between 1 and 200),
  locale            text not null default 'sl' check (locale in ('sl','en','de','hr')),
  is_platform_admin boolean not null default false,
  mfa_totp_secret   text,            -- encrypted at application level (Phase 5)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger users_touch before update on users for each row execute function touch_updated_at();

create table sessions (
  token_hash    text primary key,     -- sha256 of the opaque cookie token
  user_id       uuid not null references users(id) on delete cascade,
  active_org_id uuid,
  ip            inet,
  user_agent    text,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expiry_idx on sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Commercial configuration (global, admin-editable)
-- ---------------------------------------------------------------------------
create table subscription_plans (
  code              text primary key,
  name              text not null,
  price_month_cents integer not null check (price_month_cents >= 0),
  price_year_cents  integer not null check (price_year_cents >= 0),
  currency          char(3) not null default 'EUR',
  limits            jsonb not null default '{}'::jsonb,   -- e.g. {"units": 30, "locations": 1}
  features          jsonb not null default '[]'::jsonb,   -- feature flags
  sort              integer not null default 0,
  is_active         boolean not null default true,
  updated_at        timestamptz not null default now()
);

create table categories (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sort      integer not null default 0,
  name_i18n jsonb not null,   -- {"sl": "...", "en": "..."}
  icon      text
);

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(name) between 2 and 200),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  legal_name      text,
  tax_id          text,              -- e.g. SI12345678
  registration_no text,              -- matična številka
  vat_payer       boolean not null default true,
  country         char(2) not null default 'SI',
  currency        char(3) not null default 'EUR',
  default_locale  text not null default 'sl',
  timezone        text not null default 'Europe/Ljubljana',
  email           citext,
  phone           text,
  plan_code       text not null default 'basic' references subscription_plans(code),
  trial_ends_at   timestamptz,
  status          text not null default 'active' check (status in ('active','restricted','suspended')),
  onboarding      jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger organizations_touch before update on organizations for each row execute function touch_updated_at();

create table org_members (
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null check (role in ('owner','manager','receptionist','warehouse','field','technician','accountant','readonly')),
  status      text not null default 'active' check (status in ('active','invited','disabled')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on org_members(user_id);

create table locations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  address       text,
  postal_code   text,
  city          text,
  country       char(2) not null default 'SI',
  lat           double precision,
  lng           double precision,
  opening_hours jsonb not null default '{}'::jsonb,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (org_id, id)
);
create unique index locations_one_default on locations(org_id) where is_default;

create table org_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  key    text not null,
  value  bigint not null default 0,
  primary key (org_id, key)
);

-- ---------------------------------------------------------------------------
-- Inventory: listings (what is offered) vs units (physical items)
-- ---------------------------------------------------------------------------
create table listings (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  category_id       uuid not null references categories(id),
  location_id       uuid,
  title             text not null check (length(title) between 2 and 200),
  slug              text not null check (slug ~ '^[a-z0-9-]+$'),
  description       text not null default '',
  manufacturer      text,
  model             text,
  specs             jsonb not null default '{}'::jsonb,
  price_day_cents   integer not null check (price_day_cents >= 0),
  price_week_cents  integer check (price_week_cents >= 0),
  price_month_cents integer check (price_month_cents >= 0),
  deposit_cents     integer not null default 0 check (deposit_cents >= 0),
  buffer_minutes    integer not null default 0 check (buffer_minutes between 0 and 10080),
  booking_mode      text not null default 'request' check (booking_mode in ('instant','request')),
  delivery_available boolean not null default false,
  is_published      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, slug),
  unique (org_id, id),
  foreign key (org_id, location_id) references locations(org_id, id)
);
create trigger listings_touch before update on listings for each row execute function touch_updated_at();
create index listings_published_idx on listings(category_id) where is_published;
create index listings_search_idx on listings using gin (to_tsvector('simple', title || ' ' || coalesce(manufacturer,'') || ' ' || coalesce(model,'') || ' ' || description));

create type unit_status as enum (
  'available','reserved','awaiting_pickup','rented','awaiting_return','overdue',
  'inspection','damaged','maintenance','unavailable','retired'
);

create table units (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organizations(id) on delete cascade,
  listing_id              uuid not null,
  location_id             uuid,
  internal_code           text not null check (length(internal_code) between 1 and 60),
  serial_number           text,
  qr_token                text not null unique default encode(gen_random_bytes(12), 'hex'),
  status                  unit_status not null default 'available',
  purchase_price_cents    integer check (purchase_price_cents >= 0),
  purchase_date           date,
  replacement_value_cents integer check (replacement_value_cents >= 0),
  operating_hours         numeric(10,1),
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (org_id, internal_code),
  unique (org_id, id),
  foreign key (org_id, listing_id) references listings(org_id, id) on delete restrict,
  foreign key (org_id, location_id) references locations(org_id, id)
);
create trigger units_touch before update on units for each row execute function touch_updated_at();
create index units_listing_idx on units(listing_id);

create table unit_status_history (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references organizations(id) on delete cascade,
  unit_id       uuid not null,
  from_status   unit_status,
  to_status     unit_status not null,
  actor_user_id uuid references users(id),
  reason        text,
  created_at    timestamptz not null default now(),
  foreign key (org_id, unit_id) references units(org_id, id) on delete cascade
);
create index unit_status_history_unit_idx on unit_status_history(unit_id, created_at desc);

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------
create table customers (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  kind                 text not null default 'individual' check (kind in ('individual','business')),
  name                 text not null check (length(name) between 1 and 200),
  company_name         text,
  tax_id               text,
  email                citext,
  phone                text,
  address              text,
  notes                text,
  discount_percent     numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  marketing_consent    boolean not null default false,
  marketing_consent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, id)
);
create trigger customers_touch before update on customers for each row execute function touch_updated_at();
create index customers_org_name_idx on customers(org_id, name);

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create type reservation_status as enum (
  'draft','quotation','awaiting_confirmation','confirmed','awaiting_pickup','active',
  'awaiting_return','inspection','completed','cancelled','expired','overdue','disputed','refunded'
);

create type reservation_source as enum (
  'marketplace','direct','phone','walk_in','provider_website','existing_customer','referral','api'
);

create table reservations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  number         text not null,
  customer_id    uuid not null,
  status         reservation_status not null default 'draft',
  source         reservation_source not null default 'direct',
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  location_id    uuid,
  notes          text,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents    integer not null default 0 check (total_cents >= 0),
  deposit_cents  integer not null default 0 check (deposit_cents >= 0),
  currency       char(3) not null default 'EUR',
  created_by     uuid references users(id),
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (org_id, number),
  unique (org_id, id),
  foreign key (org_id, customer_id) references customers(org_id, id),
  foreign key (org_id, location_id) references locations(org_id, id)
);
create trigger reservations_touch before update on reservations for each row execute function touch_updated_at();
create index reservations_org_period_idx on reservations(org_id, starts_at, ends_at);
create index reservations_org_status_idx on reservations(org_id, status);

create table reservation_items (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  reservation_id   uuid not null,
  listing_id       uuid not null,
  quantity         integer not null check (quantity between 1 and 500),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  pricing_basis    text not null,   -- e.g. "3 × dan"
  unique (org_id, id),
  foreign key (org_id, reservation_id) references reservations(org_id, id) on delete cascade,
  foreign key (org_id, listing_id) references listings(org_id, id)
);

-- Allocations bind physical units to time. The exclusion constraint is the
-- authoritative double-booking guard: no two active allocations of the same
-- unit may overlap, including the configured buffer after each rental.
create table allocations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  unit_id        uuid not null,
  reservation_id uuid,
  item_id        uuid,
  kind           text not null check (kind in ('rental','maintenance','block')),
  period         tstzrange not null,     -- the customer-visible rental period
  blocked        tstzrange not null,     -- period + buffer; used for conflicts
  active         boolean not null default true,
  note           text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  check (not isempty(period) and lower(blocked) = lower(period) and upper(blocked) >= upper(period)),
  check ((kind = 'rental') = (reservation_id is not null)),
  foreign key (org_id, unit_id) references units(org_id, id) on delete cascade,
  foreign key (org_id, reservation_id) references reservations(org_id, id) on delete cascade,
  foreign key (org_id, item_id) references reservation_items(org_id, id) on delete cascade,
  constraint allocations_no_overlap exclude using gist (unit_id with =, blocked with &&) where (active)
);
create index allocations_org_period_idx on allocations using gist (org_id, blocked) where active;
create index allocations_reservation_idx on allocations(reservation_id);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table audit_logs (
  id            bigint generated always as identity primary key,
  org_id        uuid references organizations(id) on delete cascade,
  actor_user_id uuid references users(id),
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_org_idx on audit_logs(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['locations','org_counters','listings','units','unit_status_history',
                           'customers','reservations','reservation_items','allocations']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$create policy tenant_isolation on %I
                      using (org_id = app_org_id() or app_is_platform_admin())
                      with check (org_id = app_org_id() or app_is_platform_admin())$p$, t);
  end loop;
end $$;

-- Marketplace: published listings are publicly readable (read-only).
create policy public_published_read on listings for select using (is_published);

alter table organizations enable row level security;
alter table organizations force row level security;
create policy org_self on organizations
  using (id = app_org_id() or app_is_platform_admin())
  with check (id = app_org_id() or app_is_platform_admin());
-- Public provider identity for published listings (legally required business info).
create policy org_public_read on organizations for select
  using (exists (select 1 from listings l where l.org_id = organizations.id and l.is_published));

alter table audit_logs enable row level security;
alter table audit_logs force row level security;
create policy audit_tenant on audit_logs
  using (org_id = app_org_id() or app_is_platform_admin())
  with check (org_id is null or org_id = app_org_id() or app_is_platform_admin());
