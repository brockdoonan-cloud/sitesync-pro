begin;

drop policy if exists "truck_locations_operator_select" on public.truck_locations;
drop policy if exists "truck_locations_operator_insert" on public.truck_locations;
drop policy if exists "truck_tracking_imports_operator_select" on public.truck_tracking_imports;
drop policy if exists "truck_tracking_imports_operator_insert" on public.truck_tracking_imports;
drop policy if exists "truck_tracking_integrations_operator_crud" on public.truck_tracking_integrations;

drop index if exists public.truck_locations_provider_recorded_idx;
drop index if exists public.truck_locations_org_truck_recorded_idx;
drop index if exists public.trucks_tracking_provider_idx;
drop index if exists public.trucks_org_external_vehicle_idx;
drop index if exists public.truck_tracking_imports_org_created_idx;
drop index if exists public.truck_tracking_integrations_org_status_idx;
drop index if exists public.truck_tracking_integrations_webhook_token_idx;

alter table if exists public.truck_locations
  drop column if exists raw_payload,
  drop column if exists status,
  drop column if exists ignition,
  drop column if exists heading_degrees,
  drop column if exists speed_mph,
  drop column if exists external_vehicle_id,
  drop column if exists provider_id;

alter table if exists public.trucks
  drop column if exists raw_tracking_payload,
  drop column if exists last_seen_at,
  drop column if exists current_lng,
  drop column if exists current_lat,
  drop column if exists license_plate,
  drop column if exists vin,
  drop column if exists external_vehicle_id,
  drop column if exists tracking_provider_name,
  drop column if exists tracking_provider_id;

drop table if exists public.truck_tracking_imports;
drop table if exists public.truck_tracking_integrations;

commit;
