begin;

create or replace function public.get_quote_marketplace_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quote_requests%rowtype;
  response_rows jsonb;
begin
  select *
  into quote_row
  from public.quote_requests
  where access_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  if quote_row.created_at < now() - interval '90 days' then
    return jsonb_build_object('expired', true);
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.price_quote asc), '[]'::jsonb)
  into response_rows
  from public.quote_responses r
  where r.quote_request_id = quote_row.id;

  return jsonb_build_object(
    'quoteRequest', to_jsonb(quote_row),
    'responses', response_rows
  );
end;
$$;

create or replace function public.select_quote_response_by_token(
  p_quote_request_id uuid,
  p_token uuid,
  p_response_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quote_requests%rowtype;
  previous_response public.quote_responses%rowtype;
  selected_response public.quote_responses%rowtype;
begin
  select *
  into quote_row
  from public.quote_requests
  where id = p_quote_request_id
    and access_token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if quote_row.created_at < now() - interval '90 days' then
    return jsonb_build_object('error', 'expired');
  end if;

  select *
  into previous_response
  from public.quote_responses
  where id = p_response_id
    and quote_request_id = p_quote_request_id
  limit 1;

  if not found then
    return jsonb_build_object('error', 'response_not_found');
  end if;

  update public.quote_responses
  set status = 'declined'
  where quote_request_id = p_quote_request_id
    and id <> p_response_id;

  update public.quote_responses
  set status = 'selected'
  where id = p_response_id
  returning * into selected_response;

  update public.quote_requests
  set status = 'won'
  where id = p_quote_request_id;

  return jsonb_build_object(
    'quoteRequest', to_jsonb(quote_row),
    'beforeResponse', to_jsonb(previous_response),
    'response', to_jsonb(selected_response)
  );
end;
$$;

grant execute on function public.get_quote_marketplace_by_token(uuid) to anon, authenticated;
grant execute on function public.select_quote_response_by_token(uuid, uuid, uuid) to anon, authenticated;

commit;
