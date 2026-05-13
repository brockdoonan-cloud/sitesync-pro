-- Roll back profile-sheet billing automation.

begin;

drop policy if exists "operators update profile sheet files" on storage.objects;
drop policy if exists "operators upload profile sheet files" on storage.objects;
drop policy if exists "operators read profile sheet files" on storage.objects;

alter table if exists public.pricing_profiles
  drop column if exists profile_sheet_id,
  drop column if exists updated_at;

drop table if exists public.profile_sheet_billing_runs;
drop table if exists public.customer_profile_sheets;

delete from storage.objects where bucket_id = 'profile-sheets';
delete from storage.buckets where id = 'profile-sheets';

commit;
