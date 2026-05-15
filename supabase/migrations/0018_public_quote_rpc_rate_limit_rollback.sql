-- Roll back only the RPC rate-limit wrapper/table. The quote RPC itself remains available.

begin;

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

drop function if exists public.enforce_rpc_rate_limit(text, integer, integer);
drop function if exists public.request_ip_rate_limit_key();
drop table if exists public.api_rate_limits;

commit;
