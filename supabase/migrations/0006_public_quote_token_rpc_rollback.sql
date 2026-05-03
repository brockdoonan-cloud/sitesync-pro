begin;

drop function if exists public.select_quote_response_by_token(uuid, uuid, uuid);
drop function if exists public.get_quote_marketplace_by_token(uuid);

commit;
