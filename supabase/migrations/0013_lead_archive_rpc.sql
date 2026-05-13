begin;

create or replace function public.archive_quote_request(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row public.quote_requests%rowtype;
  actor_email text;
  deletion_note text;
begin
  if not public.current_user_is_operator() then
    raise exception 'Operator access required' using errcode = '42501';
  end if;

  select *
    into lead_row
    from public.quote_requests
    where id = target_id;

  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  select email
    into actor_email
    from auth.users
    where id = auth.uid();

  deletion_note := '[SiteSync archived from operator inbox] [' || now()::text || '] Archived by ' || coalesce(actor_email, auth.uid()::text) || '.';

  update public.quote_requests
     set status = 'lost',
         notes = case
           when notes is null or notes = '' then deletion_note
           else notes || E'\n\n' || deletion_note
         end
   where id = target_id
   returning * into lead_row;

  delete from public.lead_division_matches where quote_request_id = target_id;
  delete from public.quote_responses where quote_request_id = target_id;
  delete from public.sms_logs where request_id = target_id;

  return jsonb_build_object(
    'success', true,
    'id', lead_row.id,
    'status', lead_row.status
  );
end;
$$;

grant execute on function public.archive_quote_request(uuid) to authenticated;

commit;
