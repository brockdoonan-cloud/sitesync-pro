-- Roll back customer portal access codes and two-bin swap tracking.

begin;

drop policy if exists customer_accounts_operator_manage on public.customer_accounts;
drop policy if exists customer_accounts_select_own on public.customer_accounts;
drop policy if exists customer_access_codes_operator_manage on public.customer_access_codes;

drop table if exists public.customer_accounts;
drop table if exists public.customer_access_codes;

drop index if exists public.service_requests_pickup_delivery_bin_idx;
drop index if exists public.route_stops_delivery_bin_idx;
drop index if exists public.route_stops_pickup_bin_idx;

alter table public.service_requests
  drop column if exists delivery_bin_number,
  drop column if exists pickup_bin_number;

alter table public.route_stops
  drop column if exists delivered_at,
  drop column if exists picked_up_at,
  drop column if exists dropoff_address,
  drop column if exists dropoff_jobsite_id,
  drop column if exists landfill_location,
  drop column if exists delivery_bin_number,
  drop column if exists pickup_bin_number;

create or replace function public.current_user_is_client_for_client(target_org uuid, target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_org is not null
    and target_client is not null
    and exists (
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
