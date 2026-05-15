-- Rollback for 0019_multi_vertical_driver_billing.
-- This keeps production data by removing only policies/functions/indexes/columns/tables
-- introduced in 0019. Use only after explicit approval.

begin;

revoke execute on function public.run_monthly_billing(date) from service_role, postgres;
drop function if exists public.run_monthly_billing(date);
drop function if exists public.next_monthly_anniversary(date, date);

drop policy if exists "operators manage billing rates" on public.billing_rates;
drop table if exists public.billing_rates;

alter table if exists public.customer_profile_sheets
  drop column if exists ocr_raw_response,
  drop column if exists ocr_model_version,
  drop column if exists ocr_confidence_notes;

alter table if exists public.route_stops
  drop column if exists service_type_id,
  drop column if exists capture_data;

alter table if exists public.jobs
  drop column if exists equipment_type_id,
  drop column if exists service_type_id;

alter table if exists public.service_requests
  drop column if exists service_type_id;

alter table if exists public.equipment
  drop column if exists equipment_type_id,
  drop column if exists dropped_at,
  drop column if exists picked_up_at,
  drop column if exists next_billing_date,
  drop column if exists last_billed_date;

alter table if exists public.driver_routes
  drop column if exists driver_profile_id,
  drop column if exists truck_id;

drop policy if exists "operators manage service types" on public.service_types;
drop policy if exists "members read service types" on public.service_types;
drop table if exists public.service_types;

drop policy if exists "operators manage equipment types" on public.equipment_types;
drop policy if exists "members read equipment types" on public.equipment_types;
drop table if exists public.equipment_types;

drop policy if exists "drivers manage own shifts" on public.driver_shifts;
drop policy if exists "operators read all shifts" on public.driver_shifts;
drop table if exists public.driver_shifts;

drop policy if exists "drivers read own profile" on public.drivers;
drop policy if exists "operators manage drivers" on public.drivers;
drop table if exists public.drivers;

delete from supabase_migrations.schema_migrations where version = '0019';

commit;
