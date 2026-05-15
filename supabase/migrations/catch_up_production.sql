-- SiteSync Pro production catch-up migration.
--
-- Use this file only for the production database that is behind the repo
-- migrations. It is designed for ONE paste into the Supabase SQL Editor.
--
-- Production-confirmed missing objects as of 2026-05-15:
--   - public.customer_profile_sheets
--   - public.profile_sheet_billing_runs
--   - storage bucket: profile-sheets
--   - public.site_doctor_slowest_queries()
--
-- This catch-up starts at 0014 because that is the first missing dependency.
-- Everything is guarded with IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE / ON CONFLICT DO UPDATE, then the matching migration
-- versions are self-recorded in supabase_migrations.schema_migrations.

begin;

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  name text,
  statements text[]
);

create or replace function pg_temp.record_schema_migration(
  p_version text,
  p_name text
)
returns void
language plpgsql
as $$
declare
  has_name boolean;
  has_statements boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'name'
  ) into has_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'statements'
  ) into has_statements;

  if has_name and has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict (version) do nothing'
      using p_version, p_name, array['manual production catch-up'];
  elsif has_name then
    execute 'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing'
      using p_version, p_name;
  elsif has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, statements) values ($1, $2) on conflict (version) do nothing'
      using p_version, array['manual production catch-up'];
  else
    execute 'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict (version) do nothing'
      using p_version;
  end if;
end;
$$;

-- ============================================================
-- 0014_profile_sheet_billing
-- Creates profile-sheet archival and billing-run infrastructure.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-sheets',
  'profile-sheets',
  false,
  26214400,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.customer_profile_sheets (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  file_name text not null,
  file_path text,
  customer_name text,
  job_name text,
  jobsite_address text,
  extracted_terms jsonb not null default '{}'::jsonb,
  billing_rules jsonb not null default '[]'::jsonb,
  billing_preview jsonb not null default '{}'::jsonb,
  source_text_excerpt text,
  active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_sheet_billing_runs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  profile_sheet_id uuid references public.customer_profile_sheets(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  period_start date,
  period_end date,
  source_activity jsonb not null default '{}'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric default 0,
  fuel_surcharge numeric default 0,
  total numeric default 0,
  status text not null default 'draft' check (status in ('draft', 'approved', 'invoiced', 'void')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.pricing_profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists profile_sheet_id uuid references public.customer_profile_sheets(id) on delete set null,
  add column if not exists updated_at timestamptz default now();

create index if not exists customer_profile_sheets_org_created_idx
  on public.customer_profile_sheets (organization_id, created_at desc);

create index if not exists customer_profile_sheets_client_idx
  on public.customer_profile_sheets (client_id, active);

create index if not exists customer_profile_sheets_terms_gin_idx
  on public.customer_profile_sheets using gin (extracted_terms);

create index if not exists profile_sheet_billing_runs_org_created_idx
  on public.profile_sheet_billing_runs (organization_id, created_at desc);

create index if not exists profile_sheet_billing_runs_profile_idx
  on public.profile_sheet_billing_runs (profile_sheet_id);

create index if not exists pricing_profiles_profile_sheet_idx
  on public.pricing_profiles (profile_sheet_id)
  where profile_sheet_id is not null;

alter table public.customer_profile_sheets enable row level security;
alter table public.profile_sheet_billing_runs enable row level security;

drop policy if exists "operators manage customer profile sheets" on public.customer_profile_sheets;
create policy "operators manage customer profile sheets"
  on public.customer_profile_sheets for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

drop policy if exists "operators manage profile sheet billing runs" on public.profile_sheet_billing_runs;
create policy "operators manage profile sheet billing runs"
  on public.profile_sheet_billing_runs for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

drop policy if exists "operators read profile sheet files" on storage.objects;
create policy "operators read profile sheet files"
  on storage.objects for select
  using (
    bucket_id = 'profile-sheets'
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.role in ('operator_admin', 'operator_member', 'driver')
          and name like om.organization_id::text || '/%'
      )
    )
  );

drop policy if exists "operators upload profile sheet files" on storage.objects;
create policy "operators upload profile sheet files"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-sheets'
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.role in ('operator_admin', 'operator_member')
          and name like om.organization_id::text || '/%'
      )
    )
  );

drop policy if exists "operators update profile sheet files" on storage.objects;
create policy "operators update profile sheet files"
  on storage.objects for update
  using (
    bucket_id = 'profile-sheets'
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.role in ('operator_admin', 'operator_member')
          and name like om.organization_id::text || '/%'
      )
    )
  )
  with check (
    bucket_id = 'profile-sheets'
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.role in ('operator_admin', 'operator_member')
          and name like om.organization_id::text || '/%'
      )
    )
  );

select pg_temp.record_schema_migration('0014', 'profile_sheet_billing');

-- ============================================================
-- 0015_job_profile_sheet_links
-- Links signed profile sheets and billing rules to jobs.
-- ============================================================

alter table public.jobs
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists customer_id uuid references public.clients(id) on delete set null,
  add column if not exists job_name text,
  add column if not exists project_name text,
  add column if not exists name text,
  add column if not exists jobsite_address text,
  add column if not exists address text,
  add column if not exists jobsite_city text,
  add column if not exists jobsite_state_code text,
  add column if not exists jobsite_zip text,
  add column if not exists jobsite_contact_name text,
  add column if not exists jobsite_contact_phone text,
  add column if not exists jobsite_contact_email text,
  add column if not exists signed_profile_sheet_id uuid,
  add column if not exists profile_sheet_id uuid,
  add column if not exists notes text;

alter table public.customer_profile_sheets
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists fee_settings jsonb not null default '{}'::jsonb;

alter table public.profile_sheet_billing_runs
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

alter table public.pricing_profiles
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists billing_rules jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'jobs'
      and constraint_name = 'jobs_signed_profile_sheet_id_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_signed_profile_sheet_id_fkey
      foreign key (signed_profile_sheet_id) references public.customer_profile_sheets(id) on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'jobs'
      and constraint_name = 'jobs_profile_sheet_id_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_profile_sheet_id_fkey
      foreign key (profile_sheet_id) references public.customer_profile_sheets(id) on delete set null;
  end if;
end $$;

create index if not exists jobs_client_project_idx
  on public.jobs (client_id, job_name);

create index if not exists jobs_profile_sheet_idx
  on public.jobs (signed_profile_sheet_id)
  where signed_profile_sheet_id is not null;

create index if not exists customer_profile_sheets_job_idx
  on public.customer_profile_sheets (job_id, created_at desc);

create index if not exists pricing_profiles_job_idx
  on public.pricing_profiles (job_id, active)
  where job_id is not null;

update public.customer_profile_sheets cps
set fee_settings = coalesce(
  (
    select jsonb_object_agg(key, jsonb_build_object(
      'enabled', coalesce((value ->> 'enabled')::boolean, true),
      'chargeMode', coalesce(value ->> 'chargeMode', 'conditional')
    ))
    from jsonb_each(cps.extracted_terms -> 'pricing')
  ),
  '{}'::jsonb
)
where cps.fee_settings = '{}'::jsonb
  and cps.extracted_terms ? 'pricing';

select pg_temp.record_schema_migration('0015', 'job_profile_sheet_links');

-- ============================================================
-- 0016_profile_sheet_file_types
-- Allows PDFs, scans, text, CSV, and workbook uploads.
-- ============================================================

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'profile-sheets';

select pg_temp.record_schema_migration('0016', 'profile_sheet_file_types');

-- ============================================================
-- 0017_prelaunch_hardening
-- Adds import trace columns, driver charge metadata, stop-photo storage,
-- and the Site Doctor slow-query RPC.
-- ============================================================

alter table public.customer_profile_sheets
  add column if not exists import_source text default 'ocr_import'
    check (import_source in ('ocr_import', 'manual_entry'));

alter table public.profile_sheet_billing_runs
  add column if not exists import_source text default 'ocr_import'
    check (import_source in ('ocr_import', 'manual_entry'));

alter table public.service_requests
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

alter table public.route_stops
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists started_lat numeric(10,7),
  add column if not exists started_lng numeric(10,7),
  add column if not exists arrived_lat numeric(10,7),
  add column if not exists arrived_lng numeric(10,7),
  add column if not exists completed_lat numeric(10,7),
  add column if not exists completed_lng numeric(10,7),
  add column if not exists skipped_at timestamptz,
  add column if not exists skipped_reason text;

alter table public.billing_events
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists route_stop_id uuid references public.route_stops(id) on delete set null,
  add column if not exists charge_type text,
  add column if not exists amount numeric(10,2),
  add column if not exists note text,
  add column if not exists photo_url text,
  add column if not exists driver_id uuid references auth.users(id) on delete set null,
  add column if not exists status text default 'pending_review'
    check (status in ('pending_review', 'approved', 'disputed', 'void'));

create index if not exists billing_events_route_stop_idx
  on public.billing_events (route_stop_id);

create index if not exists route_stops_job_idx
  on public.route_stops (job_id, stop_order)
  where job_id is not null;

create index if not exists route_stops_client_idx
  on public.route_stops (client_id, stop_order)
  where client_id is not null;

create index if not exists billing_events_job_created_idx
  on public.billing_events (job_id, event_date desc);

create index if not exists billing_events_client_created_idx
  on public.billing_events (client_id, event_date desc);

create index if not exists customer_profile_sheets_import_source_idx
  on public.customer_profile_sheets (organization_id, import_source, created_at desc);

create index if not exists service_requests_job_idx
  on public.service_requests (job_id, scheduled_date desc)
  where job_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stop-photos',
  'stop-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "operators read stop photos" on storage.objects;
create policy "operators read stop photos"
  on storage.objects for select
  using (
    bucket_id = 'stop-photos'
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.role in ('operator_admin', 'operator_member', 'driver', 'client')
          and name like om.organization_id::text || '/%'
      )
    )
  );

drop policy if exists "drivers upload stop photos" on storage.objects;
create policy "drivers upload stop photos"
  on storage.objects for insert
  with check (
    bucket_id = 'stop-photos'
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.role in ('operator_admin', 'operator_member', 'driver')
          and name like om.organization_id::text || '/%'
      )
    )
  );

create or replace function public.site_doctor_slowest_queries()
returns table (
  query text,
  calls bigint,
  total_exec_time double precision,
  mean_exec_time double precision,
  rows bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    p.query,
    p.calls,
    p.total_exec_time,
    p.mean_exec_time,
    p.rows
  from pg_stat_statements p
  where p.query not ilike '%pg_stat_statements%'
    and p.query not ilike '%information_schema%'
  order by p.total_exec_time desc
  limit 10;
exception
  when undefined_table or insufficient_privilege then
    return;
end;
$$;

grant execute on function public.site_doctor_slowest_queries() to service_role;
grant pg_read_all_stats to service_role;

select pg_temp.record_schema_migration('0017', 'prelaunch_hardening');

-- ============================================================
-- 0018_public_quote_rpc_rate_limit
-- Adds server-side rate limiting to the public quote RPC.
-- ============================================================

create table if not exists public.api_rate_limits (
  scope text not null,
  key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key, window_start)
);

create index if not exists api_rate_limits_updated_idx
  on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;

create or replace function public.request_ip_rate_limit_key()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  headers jsonb := '{}'::jsonb;
  forwarded_for text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := '{}'::jsonb;
  end;

  forwarded_for := coalesce(
    nullif(headers->>'x-forwarded-for', ''),
    nullif(headers->>'cf-connecting-ip', ''),
    nullif(headers->>'x-real-ip', ''),
    'unknown'
  );

  return left(trim(split_part(forwarded_for, ',', 1)), 128);
end;
$$;

create or replace function public.enforce_rpc_rate_limit(
  p_scope text,
  p_max_requests integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_key text := public.request_ip_rate_limit_key();
  current_window timestamptz;
  current_count integer;
begin
  if p_max_requests <= 0 or p_window_seconds <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (scope, key, window_start, request_count)
  values (p_scope, current_key, current_window, 1)
  on conflict (scope, key, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into current_count;

  delete from public.api_rate_limits
  where updated_at < now() - interval '2 days';

  if current_count > p_max_requests then
    raise exception 'Rate limit exceeded. Please try again in a minute.'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_quote_request_with_matches(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.quote_requests%rowtype;
  clean_zip text;
  lookup public.zip_lookup%rowtype;
begin
  perform public.enforce_rpc_rate_limit('create_quote_request_with_matches', 10, 60);

  clean_zip := substring(regexp_replace(coalesce(p_payload->>'zip', ''), '[^0-9]', '', 'g') from 1 for 5);

  if clean_zip is not null and length(clean_zip) = 5 then
    select * into lookup
    from public.zip_lookup z
    where z.zip = clean_zip
    limit 1;
  end if;

  insert into public.quote_requests (
    access_token,
    name,
    email,
    phone,
    city,
    zip,
    equipment_type,
    dumpster_size,
    start_date,
    end_date,
    duration_days,
    job_type,
    notes,
    status,
    lookup_zip,
    lookup_city,
    lookup_state_code,
    lookup_lat,
    lookup_lng
  )
  values (
    coalesce(nullif(p_payload->>'access_token', '')::uuid, gen_random_uuid()),
    nullif(trim(p_payload->>'name'), ''),
    nullif(trim(p_payload->>'email'), ''),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'city'), ''),
    nullif(trim(p_payload->>'zip'), ''),
    nullif(trim(p_payload->>'equipment_type'), ''),
    nullif(trim(p_payload->>'dumpster_size'), ''),
    nullif(p_payload->>'start_date', '')::date,
    nullif(p_payload->>'end_date', '')::date,
    nullif(p_payload->>'duration_days', '')::integer,
    nullif(trim(p_payload->>'job_type'), ''),
    nullif(p_payload->>'notes', ''),
    coalesce(nullif(p_payload->>'status', ''), 'open'),
    clean_zip,
    coalesce(lookup.city, nullif(trim(p_payload->>'city'), '')),
    lookup.state_code,
    lookup.latitude,
    lookup.longitude
  )
  returning * into inserted;

  insert into public.lead_division_matches (quote_request_id, division_id, organization_id, matched_via)
  select inserted.id, d.id, d.organization_id, 'zip'
  from public.division_coverage_zips z
  join public.operator_divisions d on d.id = z.division_id
  where z.zip = clean_zip
    and d.is_active
  on conflict (quote_request_id, division_id) do nothing;

  if lookup.state_code is not null then
    insert into public.lead_division_matches (quote_request_id, division_id, organization_id, matched_via)
    select inserted.id, d.id, d.organization_id, 'state'
    from public.division_coverage_states s
    join public.operator_divisions d on d.id = s.division_id
    where s.state_code = lookup.state_code
      and d.is_active
      and not exists (
        select 1
        from public.lead_division_matches m
        where m.quote_request_id = inserted.id
          and m.division_id = d.id
      )
    on conflict (quote_request_id, division_id) do nothing;
  end if;

  return to_jsonb(inserted);
end;
$$;

grant execute on function public.create_quote_request_with_matches(jsonb) to anon, authenticated;

select pg_temp.record_schema_migration('0018', 'public_quote_rpc_rate_limit');

commit;
