-- Customer portal access codes and two-bin swap tracking.

begin;

alter table public.route_stops
  add column if not exists pickup_bin_number text,
  add column if not exists delivery_bin_number text,
  add column if not exists landfill_location text,
  add column if not exists dropoff_jobsite_id uuid references public.jobsites(id) on delete set null,
  add column if not exists dropoff_address text,
  add column if not exists picked_up_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.service_requests
  add column if not exists pickup_bin_number text,
  add column if not exists delivery_bin_number text;

create index if not exists route_stops_pickup_bin_idx
  on public.route_stops (organization_id, pickup_bin_number)
  where pickup_bin_number is not null;

create index if not exists route_stops_delivery_bin_idx
  on public.route_stops (organization_id, delivery_bin_number)
  where delivery_bin_number is not null;

create index if not exists service_requests_pickup_delivery_bin_idx
  on public.service_requests (organization_id, pickup_bin_number, delivery_bin_number);

create table if not exists public.customer_access_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  code text not null unique,
  label text,
  status text not null default 'active' check (status in ('active', 'paused', 'expired')),
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  last_used_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  access_code_id uuid references public.customer_access_codes(id) on delete set null,
  role text not null default 'client_admin' check (role in ('client_admin', 'client_user')),
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists customer_access_codes_org_client_idx
  on public.customer_access_codes (organization_id, client_id);

create index if not exists customer_access_codes_code_idx
  on public.customer_access_codes (code);

create index if not exists customer_accounts_user_idx
  on public.customer_accounts (user_id);

create index if not exists customer_accounts_org_client_idx
  on public.customer_accounts (organization_id, client_id);

alter table public.customer_access_codes enable row level security;
alter table public.customer_accounts enable row level security;

drop policy if exists customer_access_codes_operator_manage on public.customer_access_codes;
create policy customer_access_codes_operator_manage
  on public.customer_access_codes
  for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

drop policy if exists customer_accounts_select_own on public.customer_accounts;
create policy customer_accounts_select_own
  on public.customer_accounts
  for select
  using (user_id = auth.uid() or public.current_user_can_access_org(organization_id));

drop policy if exists customer_accounts_operator_manage on public.customer_accounts;
create policy customer_accounts_operator_manage
  on public.customer_accounts
  for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

create or replace function public.current_user_is_client_for_client(target_org uuid, target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_org is not null
    and target_client is not null
    and (
      exists (
        select 1
        from public.customer_accounts ca
        where ca.user_id = auth.uid()
          and ca.organization_id = target_org
          and ca.client_id = target_client
          and ca.status = 'active'
      )
      or (
        exists (
          select 1
          from public.organization_members om
          where om.user_id = auth.uid()
            and om.organization_id = target_org
            and om.role = 'client'
        )
        and exists (
          select 1
          from public.clients c
          where c.id = target_client
            and c.organization_id = target_org
            and lower(coalesce(auth.jwt() ->> 'email', '')) in (
              lower(coalesce(c.email, '')),
              lower(coalesce(c.billing_email, ''))
            )
        )
      )
    );
$$;

create or replace function public.current_user_is_client_for_customer(target_org uuid, target_client uuid, target_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    target_customer is not null
    and target_customer = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = target_org
        and om.role = 'client'
    )
  )
  or public.current_user_is_client_for_client(target_org, target_client);
$$;

commit;
