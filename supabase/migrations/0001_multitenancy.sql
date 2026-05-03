-- SiteSync Pro multi-tenant foundation.
-- Review in the PR before applying in Supabase SQL Editor.

begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('super_admin', 'operator_admin', 'operator_member', 'client')),
  created_at timestamptz default now(),
  unique (user_id, organization_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id);

create index if not exists organization_members_org_role_idx
  on public.organization_members (organization_id, role);

create or replace function public.current_user_is_super_admin()
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
      and om.role = 'super_admin'
  );
$$;

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

do $$
declare
  atlantic_id uuid;
  owner_id uuid;
  table_name text;
  business_tables text[] := array[
    'billing_events',
    'billing_import_batches',
    'clients',
    'daily_operation_events',
    'driver_routes',
    'equipment',
    'invoice_sends',
    'invoices',
    'jobs',
    'jobsites',
    'operator_profiles',
    'pricing_profiles',
    'quote_requests',
    'route_stops',
    'service_requests',
    'sms_logs',
    'truck_locations',
    'trucks'
  ];
begin
  insert into public.organizations (name, slug)
  values ('Atlantic Concrete Washout', 'atlantic-concrete')
  on conflict (slug) do update set name = excluded.name
  returning id into atlantic_id;

  select id
  into owner_id
  from auth.users
  where lower(email) = 'brock.doonan@gmail.com'
  order by created_at asc
  limit 1;

  if owner_id is not null then
    insert into public.organization_members (user_id, organization_id, role)
    values (owner_id, atlantic_id, 'super_admin')
    on conflict (user_id, organization_id) do update set role = 'super_admin';

    update public.profiles
    set role = 'admin'
    where id = owner_id;
  end if;

  foreach table_name in array business_tables loop
    execute format(
      'alter table public.%I add column if not exists organization_id uuid references public.organizations(id)',
      table_name
    );

    execute format(
      'update public.%I set organization_id = $1 where organization_id is null',
      table_name
    )
    using atlantic_id;

    execute format(
      'alter table public.%I alter column organization_id set not null',
      table_name
    );

    execute format(
      'create index if not exists %I on public.%I (organization_id)',
      table_name || '_organization_id_idx',
      table_name
    );
  end loop;

  execute 'alter table public.quote_requests alter column organization_id set default ''' || atlantic_id || '''::uuid';
end $$;

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

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "organizations_select_members"
  on public.organizations
  for select
  using (
    public.current_user_is_super_admin()
    or exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = organizations.id
    )
  );

create policy "organizations_manage_super_admin"
  on public.organizations
  for all
  using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

create policy "organization_members_select_scoped"
  on public.organization_members
  for select
  using (
    user_id = auth.uid()
    or public.current_user_is_super_admin()
    or public.current_user_can_access_org(organization_id)
  );

create policy "organization_members_manage_super_admin"
  on public.organization_members
  for all
  using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

do $$
declare
  policy_row record;
  table_name text;
  operator_only_tables text[] := array[
    'billing_events',
    'billing_import_batches',
    'daily_operation_events',
    'driver_routes',
    'invoice_sends',
    'jobs',
    'operator_profiles',
    'route_stops',
    'sms_logs',
    'truck_locations',
    'trucks'
  ];
  client_tables text[] := array[
    'clients',
    'equipment',
    'invoices',
    'jobsites',
    'pricing_profiles'
  ];
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'billing_events',
        'billing_import_batches',
        'clients',
        'daily_operation_events',
        'driver_routes',
        'equipment',
        'invoice_sends',
        'invoices',
        'jobs',
        'jobsites',
        'operator_profiles',
        'pricing_profiles',
        'quote_requests',
        'route_stops',
        'service_requests',
        'sms_logs',
        'truck_locations',
        'trucks'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;

  foreach table_name in array operator_only_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all using (public.current_user_can_access_org(organization_id)) with check (public.current_user_can_access_org(organization_id))',
      'tenant_operators_manage_' || table_name,
      table_name
    );
  end loop;

  foreach table_name in array client_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all using (public.current_user_can_access_org(organization_id)) with check (public.current_user_can_access_org(organization_id))',
      'tenant_operators_manage_' || table_name,
      table_name
    );
  end loop;
end $$;

create policy "clients_select_client_contact"
  on public.clients
  for select
  using (public.current_user_is_client_for_client(organization_id, id));

create policy "jobsites_select_client_contact"
  on public.jobsites
  for select
  using (public.current_user_is_client_for_client(organization_id, client_id));

create policy "equipment_select_client_contact"
  on public.equipment
  for select
  using (public.current_user_is_client_for_client(organization_id, coalesce(client_id, current_client_id)));

create policy "invoices_select_client_contact"
  on public.invoices
  for select
  using (public.current_user_is_client_for_client(organization_id, client_id));

create policy "pricing_profiles_select_client_contact"
  on public.pricing_profiles
  for select
  using (public.current_user_is_client_for_client(organization_id, client_id));

alter table public.service_requests enable row level security;

create policy "tenant_operators_manage_service_requests"
  on public.service_requests
  for all
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));

create policy "service_requests_select_client_contact"
  on public.service_requests
  for select
  using (public.current_user_is_client_for_customer(organization_id, client_id, customer_id));

create policy "service_requests_insert_client_contact"
  on public.service_requests
  for insert
  with check (public.current_user_is_client_for_customer(organization_id, client_id, customer_id));

create policy "service_requests_update_customer_cancel"
  on public.service_requests
  for update
  using (public.current_user_is_client_for_customer(organization_id, client_id, customer_id))
  with check (public.current_user_is_client_for_customer(organization_id, client_id, customer_id));

alter table public.quote_requests enable row level security;

create policy "quote_requests_public_insert"
  on public.quote_requests
  for insert
  with check (true);

create policy "quote_requests_operators_select"
  on public.quote_requests
  for select
  using (public.current_user_is_operator());

create policy "quote_requests_operators_update"
  on public.quote_requests
  for update
  using (public.current_user_is_operator())
  with check (public.current_user_is_operator());

create policy "quote_requests_operators_delete"
  on public.quote_requests
  for delete
  using (public.current_user_is_operator());

commit;
