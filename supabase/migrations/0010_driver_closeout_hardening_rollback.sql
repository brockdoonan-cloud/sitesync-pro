begin;

drop index if exists public.billing_events_driver_route_stop_idx;

create or replace function public.current_user_is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.role in ('super_admin', 'operator_admin', 'operator_member')
  );
$$;

create or replace function public.current_user_can_access_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_org is not null
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role = 'super_admin'
          or (
            om.organization_id = target_org
            and om.role in ('operator_admin', 'operator_member')
          )
        )
    );
$$;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('super_admin', 'operator_admin', 'operator_member', 'client'));

commit;
