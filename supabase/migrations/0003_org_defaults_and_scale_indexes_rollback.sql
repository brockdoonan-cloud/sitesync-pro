-- Roll back 0003_org_defaults_and_scale_indexes.sql.

begin;

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
  end loop;
end $$;

drop index if exists public.truck_locations_org_recorded_idx;
drop index if exists public.route_stops_org_route_order_idx;
drop index if exists public.driver_routes_org_route_date_idx;
drop index if exists public.quote_responses_org_request_idx;
drop index if exists public.quote_requests_org_status_created_idx;
drop index if exists public.invoices_org_client_status_idx;
drop index if exists public.invoices_org_created_idx;
drop index if exists public.trucks_org_number_idx;
drop index if exists public.trucks_org_status_idx;
drop index if exists public.service_requests_org_bin_idx;
drop index if exists public.service_requests_org_jobsite_status_idx;
drop index if exists public.service_requests_org_customer_status_idx;
drop index if exists public.service_requests_org_status_created_idx;
drop index if exists public.jobsites_org_client_idx;
drop index if exists public.jobsites_org_status_idx;
drop index if exists public.equipment_org_bin_number_idx;
drop index if exists public.equipment_org_jobsite_idx;
drop index if exists public.equipment_org_status_idx;

drop function if exists public.set_default_organization_id();
drop function if exists public.current_user_default_organization_id();

commit;
