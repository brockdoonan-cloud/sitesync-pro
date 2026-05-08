-- Provider-agnostic truck GPS onboarding and ingestion.

begin;

create table if not exists public.truck_tracking_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null default 'custom',
  provider_name text not null,
  connection_type text not null check (connection_type = any (array['api','webhook','csv','manual']::text[])),
  status text not null default 'setup' check (status = any (array['setup','testing','connected','paused','error']::text[])),
  api_base_url text,
  auth_type text,
  credential_reference text,
  external_account_id text,
  webhook_token uuid not null default gen_random_uuid(),
  field_mapping jsonb not null default '{}'::jsonb,
  notes text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists truck_tracking_integrations_webhook_token_idx
  on public.truck_tracking_integrations (webhook_token);

create index if not exists truck_tracking_integrations_org_status_idx
  on public.truck_tracking_integrations (organization_id, status);

create table if not exists public.truck_tracking_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.truck_tracking_integrations(id) on delete set null,
  source_file_name text,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists truck_tracking_imports_org_created_idx
  on public.truck_tracking_imports (organization_id, created_at desc);

alter table public.trucks
  add column if not exists tracking_provider_id uuid references public.truck_tracking_integrations(id) on delete set null,
  add column if not exists tracking_provider_name text,
  add column if not exists external_vehicle_id text,
  add column if not exists vin text,
  add column if not exists license_plate text,
  add column if not exists current_lat numeric(10,7),
  add column if not exists current_lng numeric(10,7),
  add column if not exists last_seen_at timestamptz,
  add column if not exists raw_tracking_payload jsonb;

create index if not exists trucks_org_external_vehicle_idx
  on public.trucks (organization_id, external_vehicle_id);

create index if not exists trucks_tracking_provider_idx
  on public.trucks (tracking_provider_id);

create table if not exists public.truck_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  truck_id uuid references public.trucks(id) on delete set null,
  truck_number text,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.truck_locations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists provider_id uuid references public.truck_tracking_integrations(id) on delete set null,
  add column if not exists external_vehicle_id text,
  add column if not exists speed_mph numeric(8,2),
  add column if not exists heading_degrees numeric(8,2),
  add column if not exists ignition boolean,
  add column if not exists status text,
  add column if not exists raw_payload jsonb;

create index if not exists truck_locations_org_truck_recorded_idx
  on public.truck_locations (organization_id, truck_number, recorded_at desc);

create index if not exists truck_locations_provider_recorded_idx
  on public.truck_locations (provider_id, recorded_at desc);

alter table public.truck_tracking_integrations enable row level security;
alter table public.truck_tracking_imports enable row level security;
alter table public.truck_locations enable row level security;

drop policy if exists "truck_tracking_integrations_operator_crud" on public.truck_tracking_integrations;
create policy "truck_tracking_integrations_operator_crud"
  on public.truck_tracking_integrations
  for all
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (om.organization_id = truck_tracking_integrations.organization_id and om.role in ('operator_admin','operator_member'))
        )
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (om.organization_id = truck_tracking_integrations.organization_id and om.role in ('operator_admin','operator_member'))
        )
    )
  );

drop policy if exists "truck_tracking_imports_operator_select" on public.truck_tracking_imports;
create policy "truck_tracking_imports_operator_select"
  on public.truck_tracking_imports
  for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (om.organization_id = truck_tracking_imports.organization_id and om.role in ('operator_admin','operator_member'))
        )
    )
  );

drop policy if exists "truck_tracking_imports_operator_insert" on public.truck_tracking_imports;
create policy "truck_tracking_imports_operator_insert"
  on public.truck_tracking_imports
  for insert
  with check (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (om.organization_id = truck_tracking_imports.organization_id and om.role in ('operator_admin','operator_member'))
        )
    )
  );

drop policy if exists "truck_locations_operator_select" on public.truck_locations;
create policy "truck_locations_operator_select"
  on public.truck_locations
  for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (om.organization_id = truck_locations.organization_id and om.role in ('operator_admin','operator_member'))
        )
    )
  );

drop policy if exists "truck_locations_operator_insert" on public.truck_locations;
create policy "truck_locations_operator_insert"
  on public.truck_locations
  for insert
  with check (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (om.organization_id = truck_locations.organization_id and om.role in ('operator_admin','operator_member'))
        )
    )
  );

commit;
