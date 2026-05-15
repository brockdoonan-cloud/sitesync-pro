-- Link signed profile sheets and billing rules to specific jobs/projects.

begin;

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

do $$
declare
  has_name boolean;
  has_statements boolean;
begin
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text,
    statements text[]
  );

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
      using '0015', 'job_profile_sheet_links', array['manual SQL Editor apply'];
  elsif has_name then
    execute 'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing'
      using '0015', 'job_profile_sheet_links';
  elsif has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, statements) values ($1, $2) on conflict (version) do nothing'
      using '0015', array['manual SQL Editor apply'];
  else
    execute 'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict (version) do nothing'
      using '0015';
  end if;
end $$;

commit;
