-- Profile-sheet billing automation for customer pricing agreements.

begin;

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

commit;
