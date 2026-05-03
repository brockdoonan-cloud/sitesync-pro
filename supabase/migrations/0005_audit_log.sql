begin;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists audit_logs_user_id_idx
  on public.audit_logs (user_id);

create index if not exists audit_logs_organization_id_idx
  on public.audit_logs (organization_id);

create index if not exists audit_logs_resource_type_idx
  on public.audit_logs (resource_type);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_super_admin_select on public.audit_logs;
create policy audit_logs_super_admin_select
  on public.audit_logs
  for select
  using (public.current_user_is_super_admin());

drop policy if exists audit_logs_service_insert on public.audit_logs;
create policy audit_logs_service_insert
  on public.audit_logs
  for insert
  with check (auth.role() = 'service_role');

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id text;
  row_org uuid;
begin
  row_id := coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, null);
  row_org := coalesce(
    case when tg_op = 'DELETE' then old.organization_id else new.organization_id end,
    null
  );

  insert into public.audit_logs (
    user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state
  ) values (
    auth.uid(),
    row_org,
    lower(tg_op),
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
  auditable_tables text[] := array[
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
    'quote_responses',
    'route_stops',
    'service_requests',
    'sms_logs',
    'truck_locations',
    'trucks'
  ];
begin
  foreach table_name in array auditable_tables loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || table_name, table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      'audit_' || table_name,
      table_name
    );
  end loop;
end $$;

commit;
