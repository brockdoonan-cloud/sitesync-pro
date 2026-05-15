-- Rate limit the public quote-request RPC used by unauthenticated lead submissions.

begin;

create table if not exists public.api_rate_limits (
  scope text not null,
  key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key, window_start)
);

create index if not exists api_rate_limits_updated_idx
  on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;

create or replace function public.request_ip_rate_limit_key()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  headers jsonb := '{}'::jsonb;
  forwarded_for text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := '{}'::jsonb;
  end;

  forwarded_for := coalesce(
    nullif(headers->>'x-forwarded-for', ''),
    nullif(headers->>'cf-connecting-ip', ''),
    nullif(headers->>'x-real-ip', ''),
    'unknown'
  );

  return left(trim(split_part(forwarded_for, ',', 1)), 128);
end;
$$;

create or replace function public.enforce_rpc_rate_limit(
  p_scope text,
  p_max_requests integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_key text := public.request_ip_rate_limit_key();
  current_window timestamptz;
  current_count integer;
begin
  if p_max_requests <= 0 or p_window_seconds <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (scope, key, window_start, request_count)
  values (p_scope, current_key, current_window, 1)
  on conflict (scope, key, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into current_count;

  delete from public.api_rate_limits
  where updated_at < now() - interval '2 days';

  if current_count > p_max_requests then
    raise exception 'Rate limit exceeded. Please try again in a minute.'
      using errcode = 'P0001';
  end if;
end;
$$;

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
  perform public.enforce_rpc_rate_limit('create_quote_request_with_matches', 10, 60);

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
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'name'
  ) into has_name;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'statements'
  ) into has_statements;

  if has_name and has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict (version) do nothing'
      using '0018', 'public_quote_rpc_rate_limit', array['manual SQL Editor apply'];
  elsif has_name then
    execute 'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing'
      using '0018', 'public_quote_rpc_rate_limit';
  elsif has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, statements) values ($1, $2) on conflict (version) do nothing'
      using '0018', array['manual SQL Editor apply'];
  else
    execute 'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict (version) do nothing'
      using '0018';
  end if;
end $$;

commit;
