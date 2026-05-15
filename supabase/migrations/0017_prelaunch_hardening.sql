-- Pre-launch hardening: observability RPC, manual profile-sheet import trace, and driver photo charges.

begin;

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
language sql
stable
security definer
set search_path = public, extensions
as $$
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
$$;

grant execute on function public.site_doctor_slowest_queries() to service_role;
grant pg_read_all_stats to service_role;

commit;
