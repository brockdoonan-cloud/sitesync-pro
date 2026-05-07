-- Rollback for 0007_zip_coverage.sql.

begin;

drop function if exists public.create_quote_request_with_matches(jsonb);

drop trigger if exists operator_divisions_set_updated_at on public.operator_divisions;
drop trigger if exists zip_lookup_set_updated_at on public.zip_lookup;

drop policy if exists "lead_division_matches_tenant_select" on public.lead_division_matches;
drop policy if exists "lead_division_matches_tenant_insert" on public.lead_division_matches;
drop policy if exists "lead_division_matches_tenant_update" on public.lead_division_matches;
drop policy if exists "lead_division_matches_tenant_delete" on public.lead_division_matches;
drop policy if exists "division_coverage_states_tenant_select" on public.division_coverage_states;
drop policy if exists "division_coverage_states_tenant_insert" on public.division_coverage_states;
drop policy if exists "division_coverage_states_tenant_update" on public.division_coverage_states;
drop policy if exists "division_coverage_states_tenant_delete" on public.division_coverage_states;
drop policy if exists "division_coverage_zips_tenant_select" on public.division_coverage_zips;
drop policy if exists "division_coverage_zips_tenant_insert" on public.division_coverage_zips;
drop policy if exists "division_coverage_zips_tenant_update" on public.division_coverage_zips;
drop policy if exists "division_coverage_zips_tenant_delete" on public.division_coverage_zips;
drop policy if exists "operator_divisions_tenant_select" on public.operator_divisions;
drop policy if exists "operator_divisions_tenant_insert" on public.operator_divisions;
drop policy if exists "operator_divisions_tenant_update" on public.operator_divisions;
drop policy if exists "operator_divisions_tenant_delete" on public.operator_divisions;
drop policy if exists "zip_lookup_public_select" on public.zip_lookup;
drop policy if exists "zip_lookup_super_admin_write" on public.zip_lookup;

alter table if exists public.quote_responses
  drop column if exists division_id;

alter table if exists public.quote_requests
  drop column if exists lookup_lng,
  drop column if exists lookup_lat,
  drop column if exists lookup_state_code,
  drop column if exists lookup_city,
  drop column if exists lookup_zip;

drop table if exists public.lead_division_matches;
drop table if exists public.division_coverage_states;
drop table if exists public.division_coverage_zips;
drop table if exists public.operator_divisions;
drop table if exists public.zip_lookup;

commit;
