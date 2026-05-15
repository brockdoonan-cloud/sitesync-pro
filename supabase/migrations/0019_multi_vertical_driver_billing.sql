-- Batch 2: multi-vertical equipment/service types, driver login, shifts, and monthly billing.

begin;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('super_admin', 'operator_admin', 'operator_member', 'driver', 'client'));

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  truck_id uuid references public.trucks(id) on delete set null,
  full_name text not null,
  phone text,
  cdl_number text,
  cdl_expires_on date,
  active boolean not null default true,
  invited_at timestamptz default now(),
  first_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists drivers_org_active_idx on public.drivers (organization_id, active);
create index if not exists drivers_truck_idx on public.drivers (truck_id) where truck_id is not null;
create index if not exists drivers_user_idx on public.drivers (user_id);

alter table public.drivers enable row level security;

drop policy if exists "operators manage drivers" on public.drivers;
create policy "operators manage drivers" on public.drivers for all
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (om.role = 'super_admin' or (om.organization_id = drivers.organization_id and om.role in ('operator_admin', 'operator_member')))
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (om.role = 'super_admin' or (om.organization_id = drivers.organization_id and om.role in ('operator_admin', 'operator_member')))
    )
  );

drop policy if exists "drivers read own profile" on public.drivers;
create policy "drivers read own profile" on public.drivers for select
  using (user_id = (select auth.uid()));

create table if not exists public.driver_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  truck_id uuid references public.trucks(id),
  clocked_in_at timestamptz not null,
  clocked_out_at timestamptz,
  clock_in_lat numeric(10,7),
  clock_in_lng numeric(10,7),
  clock_out_lat numeric(10,7),
  clock_out_lng numeric(10,7),
  total_minutes integer generated always as (
    case when clocked_out_at is null then null
      else extract(epoch from (clocked_out_at - clocked_in_at))::int / 60
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists driver_shifts_driver_date_idx on public.driver_shifts (driver_id, clocked_in_at desc);
create index if not exists driver_shifts_org_date_idx on public.driver_shifts (organization_id, clocked_in_at desc);

alter table public.driver_shifts enable row level security;

drop policy if exists "operators read all shifts" on public.driver_shifts;
create policy "operators read all shifts" on public.driver_shifts for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and (om.role = 'super_admin' or (om.organization_id = driver_shifts.organization_id and om.role in ('operator_admin', 'operator_member')))
    )
  );

drop policy if exists "drivers manage own shifts" on public.driver_shifts;
create policy "drivers manage own shifts" on public.driver_shifts for all
  using (driver_id in (select id from public.drivers where user_id = (select auth.uid())))
  with check (driver_id in (select id from public.drivers where user_id = (select auth.uid())));

alter table public.driver_routes
  add column if not exists truck_id uuid references public.trucks(id) on delete set null,
  add column if not exists driver_profile_id uuid references public.drivers(id) on delete set null;

create index if not exists driver_routes_driver_profile_date_idx
  on public.driver_routes (driver_profile_id, route_date desc)
  where driver_profile_id is not null;

create index if not exists driver_routes_truck_date_idx
  on public.driver_routes (truck_id, route_date desc)
  where truck_id is not null;

create table if not exists public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  category text not null check (category in ('bin', 'porta_john', 'dumpster', 'scaffold', 'container', 'generator', 'light_tower', 'pump', 'heater', 'fence', 'other')),
  unit_of_measure text,
  default_monthly_rate numeric(10,2),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  category text not null check (category in ('swap', 'service', 'refuel', 'inspect', 'deliver_only', 'pickup_only', 'relocate', 'emergency', 'other')),
  capture_fields jsonb not null default '[]'::jsonb,
  requires_photo boolean not null default false,
  default_rate numeric(10,2),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists equipment_types_org_active_idx on public.equipment_types (organization_id, active, sort_order);
create index if not exists service_types_org_active_idx on public.service_types (organization_id, active, sort_order);

alter table public.equipment_types enable row level security;
alter table public.service_types enable row level security;

drop policy if exists "operators manage equipment types" on public.equipment_types;
create policy "operators manage equipment types" on public.equipment_types for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

drop policy if exists "operators manage service types" on public.service_types;
create policy "operators manage service types" on public.service_types for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

drop policy if exists "members read equipment types" on public.equipment_types;
create policy "members read equipment types" on public.equipment_types for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = equipment_types.organization_id
        and om.user_id = (select auth.uid())
    )
  );

drop policy if exists "members read service types" on public.service_types;
create policy "members read service types" on public.service_types for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = service_types.organization_id
        and om.user_id = (select auth.uid())
    )
  );

with defaults(code, label, category, unit_of_measure, default_monthly_rate, sort_order) as (
  values
    ('washout_bin', 'Washout Bin', 'bin', 'each', 395::numeric, 10),
    ('porta_john', 'Portable Toilet', 'porta_john', 'each', null::numeric, 20),
    ('dumpster', 'Dumpster / Roll-off', 'dumpster', 'cy', null::numeric, 30),
    ('scaffold', 'Scaffold Section', 'scaffold', 'lf', null::numeric, 40),
    ('storage', 'Storage Container', 'container', 'each', null::numeric, 50),
    ('generator', 'Generator', 'generator', 'each', null::numeric, 60),
    ('light_tower', 'Light Tower', 'light_tower', 'each', null::numeric, 70),
    ('pump', 'Pump', 'pump', 'each', null::numeric, 80),
    ('heater', 'Heater', 'heater', 'each', null::numeric, 90),
    ('fence_panel', 'Temp Fence Panel', 'fence', 'lf', null::numeric, 100)
)
insert into public.equipment_types (organization_id, code, label, category, unit_of_measure, default_monthly_rate, sort_order)
select o.id, d.code, d.label, d.category, d.unit_of_measure, d.default_monthly_rate, d.sort_order
from public.organizations o
cross join defaults d
on conflict (organization_id, code) do nothing;

with defaults(code, label, category, requires_photo, capture_fields, sort_order) as (
  values
    ('swap', 'Swap', 'swap', false, '[{"key":"old_unit_id","label":"Old unit ID","type":"text"},{"key":"new_unit_id","label":"New unit ID","type":"text"}]'::jsonb, 10),
    ('service', 'Service / Pump-out', 'service', false, '[{"key":"volume_pumped","label":"Volume pumped (gal)","type":"number"}]'::jsonb, 20),
    ('refuel', 'Refuel', 'refuel', false, '[{"key":"gallons_added","label":"Gallons added","type":"number","required":true}]'::jsonb, 30),
    ('inspect', 'Inspect', 'inspect', true, '[{"key":"condition","label":"Condition","type":"select","options":["pass","needs_repair","damaged"]}]'::jsonb, 40),
    ('deliver', 'Deliver Only', 'deliver_only', true, '[]'::jsonb, 50),
    ('pickup', 'Pick Up Only', 'pickup_only', true, '[]'::jsonb, 60),
    ('relocate', 'Relocate', 'relocate', false, '[{"key":"new_location","label":"New location","type":"text"}]'::jsonb, 70),
    ('emergency', 'Emergency', 'emergency', true, '[{"key":"reason","label":"Reason","type":"text","required":true}]'::jsonb, 80)
)
insert into public.service_types (organization_id, code, label, category, requires_photo, capture_fields, sort_order)
select o.id, d.code, d.label, d.category, d.requires_photo, d.capture_fields, d.sort_order
from public.organizations o
cross join defaults d
on conflict (organization_id, code) do nothing;

alter table public.equipment
  add column if not exists equipment_type_id uuid references public.equipment_types(id),
  add column if not exists dropped_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists next_billing_date date,
  add column if not exists last_billed_date date;

alter table public.service_requests
  add column if not exists service_type_id uuid references public.service_types(id);

alter table public.jobs
  add column if not exists equipment_type_id uuid references public.equipment_types(id),
  add column if not exists service_type_id uuid references public.service_types(id);

alter table public.route_stops
  add column if not exists service_type_id uuid references public.service_types(id),
  add column if not exists capture_data jsonb not null default '{}'::jsonb;

create index if not exists equipment_equipment_type_idx on public.equipment (equipment_type_id) where equipment_type_id is not null;
create index if not exists service_requests_service_type_idx on public.service_requests (service_type_id) where service_type_id is not null;
create index if not exists route_stops_service_type_idx on public.route_stops (service_type_id) where service_type_id is not null;

update public.equipment e
set equipment_type_id = et.id
from public.equipment_types et
where e.equipment_type_id is null
  and et.organization_id = e.organization_id
  and et.code = 'washout_bin';

update public.service_requests sr
set service_type_id = st.id
from public.service_types st
where sr.service_type_id is null
  and st.organization_id = sr.organization_id
  and st.code = case lower(coalesce(sr.service_type, 'swap'))
    when 'swap' then 'swap'
    when 'pickup' then 'pickup'
    when 'pickup_only' then 'pickup'
    when 'delivery' then 'deliver'
    when 'deliver' then 'deliver'
    when 'deliver_only' then 'deliver'
    when 'service' then 'service'
    when 'pumpout' then 'service'
    when 'pump-out' then 'service'
    when 'pump_out' then 'service'
    when 'relocate' then 'relocate'
    else 'swap'
  end;

update public.route_stops rs
set service_type_id = st.id
from public.driver_routes dr
join public.service_types st on st.organization_id = dr.organization_id
where rs.service_type_id is null
  and dr.id = rs.route_id
  and st.code = case
    when lower(coalesce(rs.stop_type, 'swap')) like '%pickup%' then 'pickup'
    when lower(coalesce(rs.stop_type, 'swap')) like '%deliver%' then 'deliver'
    when lower(coalesce(rs.stop_type, 'swap')) like '%relocate%' then 'relocate'
    when lower(coalesce(rs.stop_type, 'swap')) like '%service%' then 'service'
    else 'swap'
  end;

create table if not exists public.billing_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  equipment_type_id uuid not null references public.equipment_types(id) on delete cascade,
  monthly_rate numeric(10,2) not null,
  fuel_surcharge_pct numeric(5,2),
  fuel_surcharge_flat numeric(10,2),
  environmental_fee numeric(10,2),
  delivery_fee numeric(10,2),
  pickup_fee numeric(10,2),
  relocate_fee numeric(10,2),
  active boolean not null default true,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, client_id, equipment_type_id)
);

create index if not exists billing_rates_org_active_idx on public.billing_rates (organization_id, active);
create index if not exists billing_rates_client_idx on public.billing_rates (client_id) where client_id is not null;

alter table public.billing_rates enable row level security;

drop policy if exists "operators manage billing rates" on public.billing_rates;
create policy "operators manage billing rates" on public.billing_rates for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

insert into public.billing_rates (organization_id, equipment_type_id, monthly_rate, fuel_surcharge_pct, environmental_fee, active)
select et.organization_id, et.id, coalesce(et.default_monthly_rate, 395), 14, 25, true
from public.equipment_types et
where et.code = 'washout_bin'
on conflict (organization_id, client_id, equipment_type_id) do nothing;

create or replace function public.next_monthly_anniversary(p_anchor date, p_on_or_after date)
returns date
language plpgsql
immutable
as $$
declare
  months integer;
  candidate date;
begin
  if p_anchor is null or p_on_or_after is null then
    return null;
  end if;

  months := greatest(
    0,
    ((extract(year from p_on_or_after)::int - extract(year from p_anchor)::int) * 12)
      + (extract(month from p_on_or_after)::int - extract(month from p_anchor)::int)
  );
  candidate := (p_anchor + make_interval(months => months))::date;

  while candidate < p_on_or_after loop
    months := months + 1;
    candidate := (p_anchor + make_interval(months => months))::date;
  end loop;

  return candidate;
end;
$$;

update public.equipment e
set
  dropped_at = coalesce(e.dropped_at, e.created_at, now()),
  next_billing_date = coalesce(e.next_billing_date, public.next_monthly_anniversary(coalesce(e.created_at, now())::date, current_date))
where e.dropped_at is null
  and coalesce(e.status, '') in ('deployed', 'needs_swap', 'swap_needed', 'needs_service', 'full', 'overflowing', 'in_transit');

alter table public.billing_events
  drop constraint if exists billing_events_status_check;

alter table public.billing_events
  add constraint billing_events_status_check
  check (coalesce(status, 'pending_review') in ('pending_review', 'approved', 'disputed', 'void', 'missing_rate'));

alter table public.customer_profile_sheets
  add column if not exists ocr_raw_response jsonb,
  add column if not exists ocr_model_version text,
  add column if not exists ocr_confidence_notes text;

create or replace function public.run_monthly_billing(p_run_date date default current_date)
returns table (
  equipment_id uuid,
  client_id uuid,
  amount numeric(10,2),
  billing_event_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  eq record;
  rate record;
  new_event_id uuid;
  line_total numeric(10,2);
  fuel_amount numeric(10,2);
begin
  for eq in
    select e.*
    from public.equipment e
    where e.dropped_at is not null
      and e.next_billing_date is not null
      and e.next_billing_date <= p_run_date
      and (e.picked_up_at is null or e.picked_up_at::date > e.next_billing_date)
  loop
    select * into rate
    from public.billing_rates br
    where br.organization_id = eq.organization_id
      and br.equipment_type_id = eq.equipment_type_id
      and br.active = true
      and (br.effective_from is null or br.effective_from <= p_run_date)
      and (br.effective_to is null or br.effective_to >= p_run_date)
      and (br.client_id = eq.client_id or br.client_id is null)
    order by (br.client_id is not null) desc, br.created_at desc
    limit 1;

    if rate is null then
      insert into public.billing_events (
        organization_id, equipment_id, client_id, event_date, charge_type, amount, note, status
      ) values (
        eq.organization_id, eq.id, eq.client_id, eq.next_billing_date, 'monthly_rental', null,
        'No active billing rate configured', 'missing_rate'
      ) returning id into new_event_id;

      update public.equipment
      set last_billed_date = eq.next_billing_date,
          next_billing_date = public.next_monthly_anniversary(eq.dropped_at::date, eq.next_billing_date + 1)
      where id = eq.id;

      equipment_id := eq.id;
      client_id := eq.client_id;
      amount := null;
      billing_event_id := new_event_id;
      return next;
      continue;
    end if;

    fuel_amount := coalesce(rate.fuel_surcharge_flat, 0)
      + (rate.monthly_rate * coalesce(rate.fuel_surcharge_pct, 0) / 100.0);

    line_total := rate.monthly_rate + coalesce(rate.environmental_fee, 0) + fuel_amount;

    insert into public.billing_events (
      organization_id, equipment_id, client_id, event_date, charge_type, amount, note, status
    ) values (
      eq.organization_id, eq.id, eq.client_id, eq.next_billing_date, 'monthly_rental', line_total,
      'Monthly rental: $' || rate.monthly_rate
        || case when coalesce(rate.environmental_fee, 0) > 0 then ' + env fee $' || rate.environmental_fee else '' end
        || case when fuel_amount > 0 then ' + fuel $' || round(fuel_amount, 2) else '' end,
      'pending_review'
    ) returning id into new_event_id;

    update public.equipment
    set last_billed_date = eq.next_billing_date,
        next_billing_date = public.next_monthly_anniversary(eq.dropped_at::date, eq.next_billing_date + 1)
    where id = eq.id;

    equipment_id := eq.id;
    client_id := eq.client_id;
    amount := line_total;
    billing_event_id := new_event_id;
    return next;
  end loop;

  return;
end;
$$;

revoke execute on function public.run_monthly_billing(date) from public, anon, authenticated;
grant execute on function public.run_monthly_billing(date) to service_role, postgres;

do $$
declare
  has_name boolean;
  has_statements boolean;
begin
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text,
    statements text[]
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'name'
  ) into has_name;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'statements'
  ) into has_statements;

  if has_name and has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict (version) do nothing'
      using '0019', 'multi_vertical_driver_billing', array['manual SQL Editor apply'];
  elsif has_name then
    execute 'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing'
      using '0019', 'multi_vertical_driver_billing';
  elsif has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, statements) values ($1, $2) on conflict (version) do nothing'
      using '0019', array['manual SQL Editor apply'];
  else
    execute 'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict (version) do nothing'
      using '0019';
  end if;
end $$;

commit;
