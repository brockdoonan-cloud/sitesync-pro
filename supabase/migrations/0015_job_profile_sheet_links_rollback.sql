-- Roll back job/profile-sheet link columns.

begin;

drop index if exists public.pricing_profiles_job_idx;
drop index if exists public.customer_profile_sheets_job_idx;
drop index if exists public.jobs_profile_sheet_idx;
drop index if exists public.jobs_client_project_idx;

alter table if exists public.jobs
  drop constraint if exists jobs_profile_sheet_id_fkey,
  drop constraint if exists jobs_signed_profile_sheet_id_fkey;

alter table if exists public.pricing_profiles
  drop column if exists billing_rules,
  drop column if exists job_id;

alter table if exists public.profile_sheet_billing_runs
  drop column if exists job_id;

alter table if exists public.customer_profile_sheets
  drop column if exists fee_settings,
  drop column if exists job_id;

alter table if exists public.jobs
  drop column if exists notes,
  drop column if exists profile_sheet_id,
  drop column if exists signed_profile_sheet_id,
  drop column if exists jobsite_contact_email,
  drop column if exists jobsite_contact_phone,
  drop column if exists jobsite_contact_name,
  drop column if exists jobsite_zip,
  drop column if exists jobsite_state_code,
  drop column if exists jobsite_city,
  drop column if exists address,
  drop column if exists jobsite_address,
  drop column if exists name,
  drop column if exists project_name,
  drop column if exists job_name,
  drop column if exists customer_id,
  drop column if exists client_id;

commit;
