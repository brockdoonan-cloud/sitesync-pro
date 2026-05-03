-- Lead response marketplace loop.
-- Requires 0001_multitenancy.sql first.

begin;

alter table public.quote_requests
  add column if not exists access_token uuid default gen_random_uuid();

update public.quote_requests
set access_token = gen_random_uuid()
where access_token is null;

alter table public.quote_requests
  alter column access_token set not null;

create unique index if not exists quote_requests_access_token_key
  on public.quote_requests (access_token);

create table if not exists public.quote_responses (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  operator_user_id uuid not null references auth.users(id),
  operator_name text not null,
  operator_company text not null,
  operator_phone text,
  operator_email text,
  price_quote numeric(10,2) not null,
  notes text,
  available_date date,
  status text not null default 'submitted' check (status in ('submitted', 'selected', 'declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists quote_responses_quote_request_id_idx
  on public.quote_responses (quote_request_id);

create index if not exists quote_responses_operator_user_id_idx
  on public.quote_responses (operator_user_id);

create index if not exists quote_responses_organization_id_idx
  on public.quote_responses (organization_id);

create unique index if not exists quote_responses_one_per_operator_org_idx
  on public.quote_responses (quote_request_id, organization_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quote_responses_set_updated_at on public.quote_responses;
create trigger quote_responses_set_updated_at
  before update on public.quote_responses
  for each row
  execute function public.set_updated_at();

alter table public.quote_responses enable row level security;

drop policy if exists "quote_responses_tenant_select" on public.quote_responses;
drop policy if exists "quote_responses_tenant_insert" on public.quote_responses;
drop policy if exists "quote_responses_tenant_update" on public.quote_responses;
drop policy if exists "quote_responses_super_admin_delete" on public.quote_responses;

create policy "quote_responses_tenant_select"
  on public.quote_responses
  for select
  using (public.current_user_can_access_org(organization_id));

create policy "quote_responses_tenant_insert"
  on public.quote_responses
  for insert
  with check (
    operator_user_id = auth.uid()
    and public.current_user_can_access_org(organization_id)
  );

create policy "quote_responses_tenant_update"
  on public.quote_responses
  for update
  using (
    public.current_user_can_access_org(organization_id)
    and (operator_user_id = auth.uid() or public.current_user_is_super_admin())
  )
  with check (
    public.current_user_can_access_org(organization_id)
    and (operator_user_id = auth.uid() or public.current_user_is_super_admin())
  );

create policy "quote_responses_super_admin_delete"
  on public.quote_responses
  for delete
  using (public.current_user_is_super_admin());

commit;
