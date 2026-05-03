begin;

do $$
declare
  table_name text;
  auditable_tables text[] := array[
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
    'quote_responses',
    'route_stops',
    'service_requests',
    'sms_logs',
    'truck_locations',
    'trucks'
  ];
begin
  foreach table_name in array auditable_tables loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || table_name, table_name);
  end loop;
end $$;

drop function if exists public.write_audit_log();

drop policy if exists audit_logs_service_insert on public.audit_logs;
drop policy if exists audit_logs_super_admin_select on public.audit_logs;

drop table if exists public.audit_logs;

commit;
