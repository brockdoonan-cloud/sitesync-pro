-- Keep existing single-tenant screens working after multi-tenancy by assigning
-- organization_id automatically, and add indexes for large fleets.

begin;

create or replace function public.current_user_default_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
      order by case om.role
        when 'operator_admin' then 1
        when 'operator_member' then 2
        when 'super_admin' then 3
        when 'client' then 4
        else 5
      end, om.created_at
      limit 1
    ),
    (
      select o.id
      from public.organizations o
      where o.slug = 'atlantic-concrete'
      limit 1
    )
  );
$$;

create or replace function public.set_default_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id = public.current_user_default_organization_id();
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
  business_tables text[] := array[
    'billing_events',
    'billing_import_batches',
    'clients',
    'daily_operation_events',
    'driver_routes',
    'equipment',
    'invoice_sends',
    'invoices',
    'jobs',
    'jobsites',
    'operator_profiles',
    'pricing_profiles',
    'quote_requests',
    'route_stops',
    'service_requests',
    'sms_logs',
    'truck_locations',
    'trucks'
  ];
begin
  foreach table_name in array business_tables loop
    execute format('drop trigger if exists %I on public.%I', 'set_default_organization_id_' || table_name, table_name);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_default_organization_id()',
      'set_default_organization_id_' || table_name,
      table_name
    );
  end loop;
end $$;

create index if not exists equipment_org_status_idx
  on public.equipment (organization_id, status);

create index if not exists equipment_org_jobsite_idx
  on public.equipment (organization_id, jobsite_id);

create index if not exists equipment_org_bin_number_idx
  on public.equipment (organization_id, bin_number);

create index if not exists jobsites_org_status_idx
  on public.jobsites (organization_id, status);

create index if not exists jobsites_org_client_idx
  on public.jobsites (organization_id, client_id);

create index if not exists service_requests_org_status_created_idx
  on public.service_requests (organization_id, status, created_at desc);

create index if not exists service_requests_org_customer_status_idx
  on public.service_requests (organization_id, customer_id, status);

create index if not exists service_requests_org_jobsite_status_idx
  on public.service_requests (organization_id, jobsite_id, status);

create index if not exists service_requests_org_bin_idx
  on public.service_requests (organization_id, bin_number);

create index if not exists trucks_org_status_idx
  on public.trucks (organization_id, status);

create index if not exists trucks_org_number_idx
  on public.trucks (organization_id, truck_number);

create index if not exists invoices_org_created_idx
  on public.invoices (organization_id, created_at desc);

create index if not exists invoices_org_client_status_idx
  on public.invoices (organization_id, client_id, status);

create index if not exists quote_requests_org_status_created_idx
  on public.quote_requests (organization_id, status, created_at desc);

create index if not exists quote_responses_org_request_idx
  on public.quote_responses (organization_id, quote_request_id);

create index if not exists driver_routes_org_route_date_idx
  on public.driver_routes (organization_id, route_date);

create index if not exists route_stops_org_route_order_idx
  on public.route_stops (organization_id, route_id, stop_order);

create index if not exists truck_locations_org_recorded_idx
  on public.truck_locations (organization_id, recorded_at desc);

commit;
