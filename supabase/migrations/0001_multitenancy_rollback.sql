-- Roll back 0001_multitenancy.sql.
-- Apply 0002_lead_response_rollback.sql first if the lead response migration has been applied.

begin;

drop policy if exists "quote_requests_operators_delete" on public.quote_requests;
drop policy if exists "quote_requests_operators_update" on public.quote_requests;
drop policy if exists "quote_requests_operators_select" on public.quote_requests;
drop policy if exists "quote_requests_public_insert" on public.quote_requests;

drop policy if exists "service_requests_update_customer_cancel" on public.service_requests;
drop policy if exists "service_requests_insert_client_contact" on public.service_requests;
drop policy if exists "service_requests_select_client_contact" on public.service_requests;
drop policy if exists "tenant_operators_manage_service_requests" on public.service_requests;

drop policy if exists "pricing_profiles_select_client_contact" on public.pricing_profiles;
drop policy if exists "invoices_select_client_contact" on public.invoices;
drop policy if exists "equipment_select_client_contact" on public.equipment;
drop policy if exists "jobsites_select_client_contact" on public.jobsites;
drop policy if exists "clients_select_client_contact" on public.clients;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        policyname like 'tenant_operators_manage_%'
        or tablename in ('organizations', 'organization_members')
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

alter table if exists public.quote_requests alter column organization_id drop default;

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
    execute format('drop index if exists public.%I', table_name || '_organization_id_idx');
    execute format('alter table if exists public.%I drop column if exists organization_id', table_name);
  end loop;
end $$;

drop function if exists public.current_user_is_client_for_customer(uuid, uuid, uuid);
drop function if exists public.current_user_is_client_for_client(uuid, uuid);
drop function if exists public.current_user_can_access_org(uuid);
drop function if exists public.current_user_is_operator();
drop function if exists public.current_user_is_super_admin();

drop table if exists public.organization_members;
drop table if exists public.organizations;

commit;
