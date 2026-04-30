-- SiteSync Pro import/schema repair
-- Run this once in Supabase SQL Editor before using the bulk import.

-- 1) Stop recursive policies from breaking unrelated table inserts.
-- This intentionally drops every policy on these tables because older generated
-- policies may have unknown names and may reference profiles recursively.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'clients', 'jobsites', 'equipment', 'service_requests', 'invoices')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_operator_email"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'brock.doonan@gmail.com'
  );

create policy "profiles_update_own_or_operator_email"
  on public.profiles
  for update
  using (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'brock.doonan@gmail.com'
  )
  with check (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'brock.doonan@gmail.com'
  );

-- 2) Add the columns used by the operator import, map, tracking, and equipment pages.
alter table public.clients
  add column if not exists company_name text,
  add column if not exists contact_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now();

alter table public.jobsites
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists client_id uuid,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now();

alter table public.equipment
  add column if not exists bin_number text,
  add column if not exists status text default 'available',
  add column if not exists location text,
  add column if not exists client_id uuid,
  add column if not exists jobsite_id uuid,
  add column if not exists last_serviced_at timestamptz,
  add column if not exists created_at timestamptz default now();

alter table public.service_requests
  add column if not exists customer_id uuid,
  add column if not exists service_type text,
  add column if not exists jobsite_address text,
  add column if not exists preferred_date date,
  add column if not exists notes text,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists client_id uuid,
  add column if not exists total numeric,
  add column if not exists amount numeric,
  add column if not exists status text default 'open',
  add column if not exists created_at timestamptz default now();

-- 3) Allow authenticated operator workflows to load operational data.
alter table public.clients enable row level security;
alter table public.jobsites enable row level security;
alter table public.equipment enable row level security;
alter table public.service_requests enable row level security;
alter table public.invoices enable row level security;

create policy "authenticated manage clients"
  on public.clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage jobsites"
  on public.jobsites for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage equipment"
  on public.equipment for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage service requests"
  on public.service_requests for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage invoices"
  on public.invoices for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4) Make sure the owner can reach the operator portal.
update public.profiles
set role = 'operator'
where id = (
  select id from auth.users where lower(email) = 'brock.doonan@gmail.com'
);
