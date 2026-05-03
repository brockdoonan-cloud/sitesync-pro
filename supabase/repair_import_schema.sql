-- SiteSync Pro import/schema repair
-- Run this once in Supabase SQL Editor before using the bulk import.

-- 1) Stop recursive policies from breaking unrelated table inserts.
-- This intentionally drops every policy on these tables because older generated
-- policies may have unknown names and may reference profiles recursively.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'clients', 'jobsites', 'equipment', 'service_requests', 'invoices', 'trucks', 'truck_locations', 'driver_routes', 'route_stops', 'pricing_profiles', 'billing_events', 'billing_import_batches', 'daily_operation_events')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_operator_email"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'brock.doonan@gmail.com'
  );

create policy "profiles_update_own_or_operator_email"
  on public.profiles
  for update
  using (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'brock.doonan@gmail.com'
  )
  with check (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'brock.doonan@gmail.com'
  );

-- 2) Add the columns used by the operator import, map, tracking, and equipment pages.
alter table public.clients
  add column if not exists company_name text,
  add column if not exists contact_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now();

alter table public.jobsites
  add column if not exists name text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists client_id uuid,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now();

alter table public.equipment
  add column if not exists container_number text,
  add column if not exists bin_number text,
  add column if not exists type text,
  add column if not exists status text default 'available',
  add column if not exists location text,
  add column if not exists current_client_id uuid,
  add column if not exists client_id uuid,
  add column if not exists current_jobsite_id uuid,
  add column if not exists jobsite_id uuid,
  add column if not exists last_serviced_at timestamptz,
  add column if not exists last_service_date date,
  add column if not exists created_at timestamptz default now();

alter table public.service_requests
  add column if not exists customer_id uuid,
  add column if not exists service_type text,
  add column if not exists jobsite_address text,
  add column if not exists preferred_date date,
  add column if not exists notes text,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists client_id uuid,
  add column if not exists client_name text,
  add column if not exists customer_name text,
  add column if not exists project_name text,
  add column if not exists email text,
  add column if not exists client_email text,
  add column if not exists total numeric,
  add column if not exists amount numeric,
  add column if not exists balance numeric,
  add column if not exists status text default 'open',
  add column if not exists invoice_date date,
  add column if not exists service_date date,
  add column if not exists due_date date,
  add column if not exists source_file text,
  add column if not exists source_row int,
  add column if not exists audit_hash text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

alter table public.service_requests
  add column if not exists bin_number text,
  add column if not exists scheduled_date date,
  add column if not exists service_address text,
  add column if not exists priority text,
  add column if not exists client_id uuid,
  add column if not exists jobsite_id uuid;

create table if not exists public.trucks (
  id uuid default gen_random_uuid() primary key,
  truck_number text,
  status text default 'available',
  capacity int default 6,
  lat double precision,
  lng double precision,
  last_seen timestamptz,
  created_at timestamptz default now()
);

alter table public.trucks
  add column if not exists truck_number text,
  add column if not exists driver_name text,
  add column if not exists status text default 'available',
  add column if not exists capacity int default 6,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists last_seen timestamptz,
  add column if not exists created_at timestamptz default now();

create table if not exists public.pricing_profiles (
  id uuid default gen_random_uuid() primary key,
  client_id uuid,
  name text not null,
  yard_address text,
  included_miles numeric default 30,
  extra_mile_rate numeric default 4.5,
  mileage_bands jsonb default '[{"label":"0-30 miles included","minMiles":0,"maxMiles":30,"rate":0},{"label":"31-50 miles","minMiles":31,"maxMiles":50,"rate":4.5},{"label":"51+ miles","minMiles":51,"maxMiles":null,"rate":6.5}]'::jsonb,
  one_bin_service numeric default 395,
  two_bin_service numeric default 350,
  water_pumpout numeric default 395,
  relocate numeric default 395,
  onsite_relocate numeric default 150,
  monthly_usage numeric default 150,
  fuel_surcharge_percent numeric default 14,
  environmental_fee numeric default 25,
  trash_fee numeric default 350,
  dead_run numeric default 395,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.pricing_profiles
  add column if not exists mileage_bands jsonb default '[{"label":"0-30 miles included","minMiles":0,"maxMiles":30,"rate":0},{"label":"31-50 miles","minMiles":31,"maxMiles":50,"rate":4.5},{"label":"51+ miles","minMiles":51,"maxMiles":null,"rate":6.5}]'::jsonb;

create table if not exists public.truck_locations (
  id uuid default gen_random_uuid() primary key,
  truck_id uuid,
  truck_number text,
  driver_id uuid,
  driver_name text,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  speed_mph numeric,
  status text default 'active',
  recorded_at timestamptz default now()
);

create table if not exists public.driver_routes (
  id uuid default gen_random_uuid() primary key,
  route_date date default current_date,
  truck_id uuid,
  truck_number text,
  driver_id uuid,
  driver_name text,
  status text default 'planned',
  start_address text,
  total_miles numeric default 0,
  estimated_minutes int default 0,
  optimized_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.route_stops (
  id uuid default gen_random_uuid() primary key,
  route_id uuid references public.driver_routes(id) on delete cascade,
  stop_order int not null,
  jobsite_id uuid,
  service_request_id uuid,
  address text,
  lat double precision,
  lng double precision,
  bin_numbers text[],
  stop_type text default 'swap',
  status text default 'planned',
  eta timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.billing_events (
  id uuid default gen_random_uuid() primary key,
  event_date date,
  event_type text not null,
  source_file text,
  source_row int,
  client_name text,
  project_name text,
  invoice_number text,
  bin_number text,
  amount numeric,
  balance numeric,
  audit_hash text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists public.billing_import_batches (
  id uuid default gen_random_uuid() primary key,
  source_file text not null,
  imported_by uuid default auth.uid(),
  line_count int default 0,
  total_amount numeric default 0,
  ending_balance numeric default 0,
  audit_hash text,
  created_at timestamptz default now()
);

create table if not exists public.daily_operation_events (
  id uuid default gen_random_uuid() primary key,
  event_date date not null,
  source_file text,
  source_sheet text,
  source_row int,
  client_name text,
  project_name text,
  bin_number text,
  operation text,
  bin_type text,
  comments text,
  audit_hash text,
  created_at timestamptz default now()
);

-- 2b) Guardrails for repeat imports.
create unique index if not exists clients_company_name_normalized_key
  on public.clients (lower(trim(company_name)))
  where company_name is not null;

create unique index if not exists jobsites_client_name_address_key
  on public.jobsites (client_id, lower(trim(name)), lower(trim(address)))
  where name is not null and address is not null;

create index if not exists invoices_invoice_number_idx
  on public.invoices (invoice_number)
  where invoice_number is not null;

create index if not exists invoices_invoice_date_idx
  on public.invoices (invoice_date);

create index if not exists invoices_audit_hash_idx
  on public.invoices (audit_hash);

create index if not exists billing_events_event_date_idx
  on public.billing_events (event_date);

create index if not exists billing_events_invoice_number_idx
  on public.billing_events (invoice_number);

create index if not exists billing_events_bin_number_idx
  on public.billing_events (bin_number);

create index if not exists daily_operation_events_event_date_idx
  on public.daily_operation_events (event_date);

create index if not exists daily_operation_events_bin_number_idx
  on public.daily_operation_events (bin_number);

create index if not exists daily_operation_events_audit_hash_idx
  on public.daily_operation_events (audit_hash);

create index if not exists truck_locations_truck_recorded_idx
  on public.truck_locations (truck_number, recorded_at desc);

create index if not exists driver_routes_route_date_idx
  on public.driver_routes (route_date);

create index if not exists route_stops_route_order_idx
  on public.route_stops (route_id, stop_order);

create index if not exists pricing_profiles_client_idx
  on public.pricing_profiles (client_id, active);

-- 3) Allow authenticated operator workflows to load operational data.
alter table public.clients enable row level security;
alter table public.jobsites enable row level security;
alter table public.equipment enable row level security;
alter table public.service_requests enable row level security;
alter table public.trucks enable row level security;
alter table public.truck_locations enable row level security;
alter table public.driver_routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.pricing_profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_import_batches enable row level security;
alter table public.daily_operation_events enable row level security;

create policy "authenticated manage clients"
  on public.clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage jobsites"
  on public.jobsites for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage equipment"
  on public.equipment for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage service requests"
  on public.service_requests for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage trucks"
  on public.trucks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage truck locations"
  on public.truck_locations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage driver routes"
  on public.driver_routes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage route stops"
  on public.route_stops for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage pricing profiles"
  on public.pricing_profiles for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage invoices"
  on public.invoices for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage billing events"
  on public.billing_events for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage billing import batches"
  on public.billing_import_batches for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage daily operation events"
  on public.daily_operation_events for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4) Make sure the owner can reach the operator portal.
update public.profiles
set role = 'operator'
where id = (
  select id from auth.users where lower(email) = 'brock.doonan@gmail.com'
);
