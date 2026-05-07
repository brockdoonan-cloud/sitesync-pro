-- SiteSync Pro territory coverage and lead matching.
-- This migration adds ZIP/state coverage, matched-lead audit rows, and a public
-- quote insert RPC so anonymous leads can be routed without exposing service keys.

begin;

create table if not exists public.zip_lookup (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  city text,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  county_name text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  timezone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists zip_lookup_state_county_idx
  on public.zip_lookup (state_code, county_name);

create table if not exists public.operator_divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address_line1 text,
  city text,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  zip text check (zip is null or zip ~ '^[0-9]{5}$'),
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists operator_divisions_org_idx
  on public.operator_divisions (organization_id);

create index if not exists operator_divisions_org_active_idx
  on public.operator_divisions (organization_id, is_active);

create index if not exists operator_divisions_state_idx
  on public.operator_divisions (state_code);

create table if not exists public.division_coverage_zips (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.operator_divisions(id) on delete cascade,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  created_at timestamptz default now(),
  unique (division_id, zip)
);

create index if not exists division_coverage_zips_zip_idx
  on public.division_coverage_zips (zip);

create index if not exists division_coverage_zips_division_idx
  on public.division_coverage_zips (division_id);

create table if not exists public.division_coverage_states (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.operator_divisions(id) on delete cascade,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  created_at timestamptz default now(),
  unique (division_id, state_code)
);

create index if not exists division_coverage_states_state_idx
  on public.division_coverage_states (state_code);

create index if not exists division_coverage_states_division_idx
  on public.division_coverage_states (division_id);

create table if not exists public.lead_division_matches (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  division_id uuid not null references public.operator_divisions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matched_via text not null check (matched_via in ('zip', 'state', 'manual')),
  matched_at timestamptz default now(),
  unique (quote_request_id, division_id)
);

create index if not exists lead_division_matches_quote_idx
  on public.lead_division_matches (quote_request_id);

create index if not exists lead_division_matches_division_idx
  on public.lead_division_matches (division_id);

create index if not exists lead_division_matches_org_idx
  on public.lead_division_matches (organization_id);

alter table public.quote_requests
  add column if not exists lookup_zip text,
  add column if not exists lookup_city text,
  add column if not exists lookup_state_code text,
  add column if not exists lookup_lat numeric(10,7),
  add column if not exists lookup_lng numeric(10,7);

create index if not exists quote_requests_lookup_zip_idx
  on public.quote_requests (lookup_zip);

create index if not exists quote_requests_lookup_state_idx
  on public.quote_requests (lookup_state_code);

alter table public.quote_responses
  add column if not exists division_id uuid references public.operator_divisions(id);

create index if not exists quote_responses_division_id_idx
  on public.quote_responses (division_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists zip_lookup_set_updated_at on public.zip_lookup;
create trigger zip_lookup_set_updated_at
  before update on public.zip_lookup
  for each row execute function public.set_updated_at();

drop trigger if exists operator_divisions_set_updated_at on public.operator_divisions;
create trigger operator_divisions_set_updated_at
  before update on public.operator_divisions
  for each row execute function public.set_updated_at();

alter table public.zip_lookup enable row level security;
alter table public.operator_divisions enable row level security;
alter table public.division_coverage_zips enable row level security;
alter table public.division_coverage_states enable row level security;
alter table public.lead_division_matches enable row level security;

drop policy if exists "zip_lookup_public_select" on public.zip_lookup;
drop policy if exists "zip_lookup_super_admin_write" on public.zip_lookup;
create policy "zip_lookup_public_select"
  on public.zip_lookup for select
  using (true);
create policy "zip_lookup_super_admin_write"
  on public.zip_lookup for all
  using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

drop policy if exists "operator_divisions_tenant_select" on public.operator_divisions;
drop policy if exists "operator_divisions_tenant_insert" on public.operator_divisions;
drop policy if exists "operator_divisions_tenant_update" on public.operator_divisions;
drop policy if exists "operator_divisions_tenant_delete" on public.operator_divisions;
create policy "operator_divisions_tenant_select"
  on public.operator_divisions for select
  using (public.current_user_can_access_org(organization_id));
create policy "operator_divisions_tenant_insert"
  on public.operator_divisions for insert
  with check (public.current_user_can_access_org(organization_id));
create policy "operator_divisions_tenant_update"
  on public.operator_divisions for update
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));
create policy "operator_divisions_tenant_delete"
  on public.operator_divisions for delete
  using (public.current_user_can_access_org(organization_id));

drop policy if exists "division_coverage_zips_tenant_select" on public.division_coverage_zips;
drop policy if exists "division_coverage_zips_tenant_insert" on public.division_coverage_zips;
drop policy if exists "division_coverage_zips_tenant_update" on public.division_coverage_zips;
drop policy if exists "division_coverage_zips_tenant_delete" on public.division_coverage_zips;
create policy "division_coverage_zips_tenant_select"
  on public.division_coverage_zips for select
  using (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_zips.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );
create policy "division_coverage_zips_tenant_insert"
  on public.division_coverage_zips for insert
  with check (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_zips.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );
create policy "division_coverage_zips_tenant_update"
  on public.division_coverage_zips for update
  using (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_zips.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_zips.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );
create policy "division_coverage_zips_tenant_delete"
  on public.division_coverage_zips for delete
  using (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_zips.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );

drop policy if exists "division_coverage_states_tenant_select" on public.division_coverage_states;
drop policy if exists "division_coverage_states_tenant_insert" on public.division_coverage_states;
drop policy if exists "division_coverage_states_tenant_update" on public.division_coverage_states;
drop policy if exists "division_coverage_states_tenant_delete" on public.division_coverage_states;
create policy "division_coverage_states_tenant_select"
  on public.division_coverage_states for select
  using (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_states.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );
create policy "division_coverage_states_tenant_insert"
  on public.division_coverage_states for insert
  with check (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_states.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );
create policy "division_coverage_states_tenant_update"
  on public.division_coverage_states for update
  using (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_states.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_states.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );
create policy "division_coverage_states_tenant_delete"
  on public.division_coverage_states for delete
  using (
    exists (
      select 1 from public.operator_divisions d
      where d.id = division_coverage_states.division_id
        and public.current_user_can_access_org(d.organization_id)
    )
  );

drop policy if exists "lead_division_matches_tenant_select" on public.lead_division_matches;
drop policy if exists "lead_division_matches_tenant_insert" on public.lead_division_matches;
drop policy if exists "lead_division_matches_tenant_update" on public.lead_division_matches;
drop policy if exists "lead_division_matches_tenant_delete" on public.lead_division_matches;
create policy "lead_division_matches_tenant_select"
  on public.lead_division_matches for select
  using (public.current_user_can_access_org(organization_id));
create policy "lead_division_matches_tenant_insert"
  on public.lead_division_matches for insert
  with check (public.current_user_can_access_org(organization_id));
create policy "lead_division_matches_tenant_update"
  on public.lead_division_matches for update
  using (public.current_user_can_access_org(organization_id))
  with check (public.current_user_can_access_org(organization_id));
create policy "lead_division_matches_tenant_delete"
  on public.lead_division_matches for delete
  using (public.current_user_can_access_org(organization_id));

create or replace function public.create_quote_request_with_matches(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.quote_requests%rowtype;
  clean_zip text;
  lookup public.zip_lookup%rowtype;
begin
  clean_zip := substring(regexp_replace(coalesce(p_payload->>'zip', ''), '[^0-9]', '', 'g') from 1 for 5);

  if clean_zip is not null and length(clean_zip) = 5 then
    select * into lookup
    from public.zip_lookup z
    where z.zip = clean_zip
    limit 1;
  end if;

  insert into public.quote_requests (
    access_token,
    name,
    email,
    phone,
    city,
    zip,
    equipment_type,
    dumpster_size,
    start_date,
    end_date,
    duration_days,
    job_type,
    notes,
    status,
    lookup_zip,
    lookup_city,
    lookup_state_code,
    lookup_lat,
    lookup_lng
  )
  values (
    coalesce(nullif(p_payload->>'access_token', '')::uuid, gen_random_uuid()),
    nullif(trim(p_payload->>'name'), ''),
    nullif(trim(p_payload->>'email'), ''),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'city'), ''),
    nullif(trim(p_payload->>'zip'), ''),
    nullif(trim(p_payload->>'equipment_type'), ''),
    nullif(trim(p_payload->>'dumpster_size'), ''),
    nullif(p_payload->>'start_date', '')::date,
    nullif(p_payload->>'end_date', '')::date,
    nullif(p_payload->>'duration_days', '')::integer,
    nullif(trim(p_payload->>'job_type'), ''),
    nullif(p_payload->>'notes', ''),
    coalesce(nullif(p_payload->>'status', ''), 'open'),
    clean_zip,
    coalesce(lookup.city, nullif(trim(p_payload->>'city'), '')),
    lookup.state_code,
    lookup.latitude,
    lookup.longitude
  )
  returning * into inserted;

  insert into public.lead_division_matches (quote_request_id, division_id, organization_id, matched_via)
  select inserted.id, d.id, d.organization_id, 'zip'
  from public.division_coverage_zips z
  join public.operator_divisions d on d.id = z.division_id
  where z.zip = clean_zip
    and d.is_active
  on conflict (quote_request_id, division_id) do nothing;

  if lookup.state_code is not null then
    insert into public.lead_division_matches (quote_request_id, division_id, organization_id, matched_via)
    select inserted.id, d.id, d.organization_id, 'state'
    from public.division_coverage_states s
    join public.operator_divisions d on d.id = s.division_id
    where s.state_code = lookup.state_code
      and d.is_active
      and not exists (
        select 1
        from public.lead_division_matches m
        where m.quote_request_id = inserted.id
          and m.division_id = d.id
      )
    on conflict (quote_request_id, division_id) do nothing;
  end if;

  return to_jsonb(inserted);
end;
$$;

grant execute on function public.create_quote_request_with_matches(jsonb) to anon, authenticated;

do $$
declare
  atlantic_id uuid;
  atlantic_division_id uuid;
begin
  select id into atlantic_id
  from public.organizations
  where slug = 'atlantic-concrete'
  limit 1;

  if atlantic_id is not null then
    insert into public.operator_divisions (organization_id, name, city, state_code, zip, is_active)
    select atlantic_id, 'Atlantic Concrete - Main', 'Orlando', 'FL', '32830', true
    where not exists (
      select 1
      from public.operator_divisions d
      where d.organization_id = atlantic_id
        and d.name = 'Atlantic Concrete - Main'
    );

    select id into atlantic_division_id
    from public.operator_divisions
    where organization_id = atlantic_id
      and name = 'Atlantic Concrete - Main'
    order by created_at asc
    limit 1;

    if atlantic_division_id is not null then
      insert into public.division_coverage_states (division_id, state_code)
      values (atlantic_division_id, 'FL')
      on conflict (division_id, state_code) do nothing;

      insert into public.division_coverage_zips (division_id, zip)
      values
        (atlantic_division_id, '32801'),
        (atlantic_division_id, '32827'),
        (atlantic_division_id, '32830'),
        (atlantic_division_id, '32953'),
        (atlantic_division_id, '34746')
      on conflict (division_id, zip) do nothing;
    end if;
  end if;
end $$;

update public.quote_requests qr
set lookup_zip = substring(regexp_replace(coalesce(qr.zip, ''), '[^0-9]', '', 'g') from 1 for 5)
where qr.lookup_zip is null
  and length(substring(regexp_replace(coalesce(qr.zip, ''), '[^0-9]', '', 'g') from 1 for 5)) = 5;

update public.quote_requests qr
set lookup_city = coalesce(z.city, qr.city),
    lookup_state_code = z.state_code,
    lookup_lat = z.latitude,
    lookup_lng = z.longitude
from public.zip_lookup z
where qr.lookup_zip = z.zip
  and (
    qr.lookup_state_code is null
    or qr.lookup_city is null
    or qr.lookup_lat is null
    or qr.lookup_lng is null
  );

insert into public.lead_division_matches (quote_request_id, division_id, organization_id, matched_via)
select qr.id, d.id, d.organization_id, 'zip'
from public.quote_requests qr
join public.division_coverage_zips z on z.zip = qr.lookup_zip
join public.operator_divisions d on d.id = z.division_id
where d.is_active
on conflict (quote_request_id, division_id) do nothing;

insert into public.lead_division_matches (quote_request_id, division_id, organization_id, matched_via)
select qr.id, d.id, d.organization_id, 'state'
from public.quote_requests qr
join public.division_coverage_states s on s.state_code = qr.lookup_state_code
join public.operator_divisions d on d.id = s.division_id
where d.is_active
  and not exists (
    select 1
    from public.lead_division_matches m
    where m.quote_request_id = qr.id
      and m.division_id = d.id
  )
on conflict (quote_request_id, division_id) do nothing;

commit;
