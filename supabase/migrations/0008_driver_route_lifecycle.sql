-- Driver route lifecycle, ETA tracking, and billing closeout hooks.

begin;

alter table public.driver_routes
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists current_stop_id uuid,
  add column if not exists last_eta_at timestamptz,
  add column if not exists driver_notes text;

alter table public.route_stops
  add column if not exists started_at timestamptz,
  add column if not exists eta_minutes integer,
  add column if not exists driver_notes text,
  add column if not exists proof_notes text,
  add column if not exists completed_by_user_id uuid references auth.users(id);

alter table public.service_requests
  add column if not exists eta_at timestamptz,
  add column if not exists route_stop_id uuid references public.route_stops(id);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'driver_routes'
      and constraint_name = 'driver_routes_current_stop_id_fkey'
  ) then
    alter table public.driver_routes
      add constraint driver_routes_current_stop_id_fkey
      foreign key (current_stop_id) references public.route_stops(id) on delete set null;
  end if;
end $$;

create index if not exists driver_routes_org_status_date_idx
  on public.driver_routes (organization_id, status, route_date desc);

create index if not exists route_stops_route_status_order_idx
  on public.route_stops (route_id, status, stop_order);

create index if not exists route_stops_service_request_idx
  on public.route_stops (service_request_id);

create index if not exists service_requests_eta_idx
  on public.service_requests (organization_id, eta_at);

alter table public.equipment
  drop constraint if exists equipment_status_check;

alter table public.equipment
  add constraint equipment_status_check
  check (
    status = any (
      array[
        'available',
        'deployed',
        'maintenance',
        'retired',
        'in_transit',
        'needs_swap',
        'swap_needed',
        'needs_service',
        'full',
        'overflowing'
      ]::text[]
    )
  );

alter table public.service_requests
  drop constraint if exists service_requests_status_check;

alter table public.service_requests
  add constraint service_requests_status_check
  check (
    status = any (
      array[
        'pending',
        'dispatch_ready',
        'confirmed',
        'scheduled',
        'dispatched',
        'en_route',
        'arrived',
        'in_progress',
        'completed',
        'cancelled'
      ]::text[]
    )
  );

alter table public.service_requests
  drop constraint if exists service_requests_priority_check;

alter table public.service_requests
  add constraint service_requests_priority_check
  check (priority = any (array['low','normal','high','urgent','emergency']::text[]));

commit;
