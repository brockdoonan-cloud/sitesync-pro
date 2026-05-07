begin;

drop index if exists public.service_requests_eta_idx;
drop index if exists public.route_stops_service_request_idx;
drop index if exists public.route_stops_route_status_order_idx;
drop index if exists public.driver_routes_org_status_date_idx;

alter table if exists public.equipment
  drop constraint if exists equipment_status_check;

alter table if exists public.equipment
  add constraint equipment_status_check
  check (status = any (array['available','deployed','maintenance','retired']::text[]));

alter table if exists public.service_requests
  drop constraint if exists service_requests_status_check;

alter table if exists public.service_requests
  add constraint service_requests_status_check
  check (status = any (array['pending','confirmed','in_progress','completed','cancelled']::text[]));

alter table if exists public.service_requests
  drop constraint if exists service_requests_priority_check;

alter table if exists public.service_requests
  add constraint service_requests_priority_check
  check (priority = any (array['low','normal','high','emergency']::text[]));

alter table if exists public.service_requests
  drop column if exists route_stop_id,
  drop column if exists eta_at;

alter table if exists public.driver_routes
  drop constraint if exists driver_routes_current_stop_id_fkey;

alter table if exists public.route_stops
  drop column if exists completed_by_user_id,
  drop column if exists proof_notes,
  drop column if exists driver_notes,
  drop column if exists eta_minutes,
  drop column if exists started_at;

alter table if exists public.driver_routes
  drop column if exists driver_notes,
  drop column if exists last_eta_at,
  drop column if exists current_stop_id,
  drop column if exists closed_at,
  drop column if exists opened_at;

commit;
