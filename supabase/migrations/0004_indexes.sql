-- Additional production indexes based on current Supabase query patterns.
-- 0003_org_defaults_and_scale_indexes.sql already covers the heaviest fleet/map paths.

begin;

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists organization_members_user_role_idx
  on public.organization_members (user_id, role);

create index if not exists organization_members_org_role_idx
  on public.organization_members (organization_id, role);

create index if not exists clients_org_created_idx
  on public.clients (organization_id, created_at desc);

create index if not exists clients_org_status_idx
  on public.clients (organization_id, status);

create index if not exists jobs_org_scheduled_idx
  on public.jobs (organization_id, scheduled_date);

create index if not exists jobs_org_status_idx
  on public.jobs (organization_id, status);

create index if not exists jobs_org_service_request_idx
  on public.jobs (organization_id, service_request_id);

create index if not exists jobsites_org_address_idx
  on public.jobsites (organization_id, address);

create index if not exists jobsites_org_name_idx
  on public.jobsites (organization_id, name);

create index if not exists quote_requests_access_token_idx
  on public.quote_requests (access_token);

create index if not exists quote_requests_access_token_created_idx
  on public.quote_requests (access_token, created_at);

create index if not exists quote_responses_request_created_idx
  on public.quote_responses (quote_request_id, created_at);

create index if not exists quote_responses_request_price_idx
  on public.quote_responses (quote_request_id, price_quote);

create index if not exists quote_responses_operator_idx
  on public.quote_responses (operator_user_id);

create index if not exists quote_responses_org_status_idx
  on public.quote_responses (organization_id, status);

create index if not exists service_requests_customer_created_idx
  on public.service_requests (customer_id, created_at desc);

create index if not exists service_requests_customer_status_created_idx
  on public.service_requests (customer_id, status, created_at desc);

create index if not exists service_requests_org_created_idx
  on public.service_requests (organization_id, created_at desc);

create index if not exists service_requests_preferred_date_idx
  on public.service_requests (organization_id, preferred_date);

create index if not exists sms_logs_request_created_idx
  on public.sms_logs (request_id, created_at desc);

create index if not exists invoices_org_invoice_date_idx
  on public.invoices (organization_id, invoice_date desc);

create index if not exists invoices_invoice_number_idx
  on public.invoices (invoice_number);

create index if not exists billing_events_org_invoice_idx
  on public.billing_events (organization_id, invoice_id);

create index if not exists billing_events_org_service_idx
  on public.billing_events (organization_id, service_request_id);

create index if not exists daily_operation_events_source_date_idx
  on public.daily_operation_events (source_file, event_date);

create index if not exists daily_operation_events_org_date_idx
  on public.daily_operation_events (organization_id, event_date desc);

create index if not exists daily_operation_events_org_bin_idx
  on public.daily_operation_events (organization_id, bin_number);

create index if not exists pricing_profiles_org_created_idx
  on public.pricing_profiles (organization_id, created_at desc);

create index if not exists operator_profiles_org_user_idx
  on public.operator_profiles (organization_id, user_id);

create index if not exists truck_locations_truck_recorded_idx
  on public.truck_locations (truck_id, recorded_at desc);

commit;
