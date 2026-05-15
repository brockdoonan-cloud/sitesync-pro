-- Roll back pre-launch hardening additions. Use only on a scratch database or before production data depends on these fields.

begin;

drop function if exists public.site_doctor_slowest_queries();

drop policy if exists "operators read stop photos" on storage.objects;
drop policy if exists "drivers upload stop photos" on storage.objects;

delete from storage.buckets where id = 'stop-photos';

drop index if exists public.billing_events_route_stop_idx;
drop index if exists public.billing_events_job_created_idx;
drop index if exists public.billing_events_client_created_idx;
drop index if exists public.route_stops_job_idx;
drop index if exists public.route_stops_client_idx;
drop index if exists public.customer_profile_sheets_import_source_idx;
drop index if exists public.service_requests_job_idx;

alter table public.billing_events
  drop column if exists status,
  drop column if exists driver_id,
  drop column if exists photo_url,
  drop column if exists note,
  drop column if exists amount,
  drop column if exists charge_type,
  drop column if exists route_stop_id,
  drop column if exists job_id,
  drop column if exists client_id;

alter table public.route_stops
  drop column if exists skipped_reason,
  drop column if exists skipped_at,
  drop column if exists completed_lng,
  drop column if exists completed_lat,
  drop column if exists arrived_lng,
  drop column if exists arrived_lat,
  drop column if exists started_lng,
  drop column if exists started_lat,
  drop column if exists client_id,
  drop column if exists job_id;

alter table public.profile_sheet_billing_runs
  drop column if exists import_source;

alter table public.service_requests
  drop column if exists job_id;

alter table public.customer_profile_sheets
  drop column if exists import_source;

commit;
