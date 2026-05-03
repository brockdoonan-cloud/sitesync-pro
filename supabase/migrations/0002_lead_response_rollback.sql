-- Roll back 0002_lead_response.sql.

begin;

drop policy if exists "quote_responses_super_admin_delete" on public.quote_responses;
drop policy if exists "quote_responses_tenant_update" on public.quote_responses;
drop policy if exists "quote_responses_tenant_insert" on public.quote_responses;
drop policy if exists "quote_responses_tenant_select" on public.quote_responses;

drop trigger if exists quote_responses_set_updated_at on public.quote_responses;
drop index if exists public.quote_responses_one_per_operator_org_idx;
drop index if exists public.quote_responses_organization_id_idx;
drop index if exists public.quote_responses_operator_user_id_idx;
drop index if exists public.quote_responses_quote_request_id_idx;
drop table if exists public.quote_responses;

drop index if exists public.quote_requests_access_token_key;
alter table if exists public.quote_requests
  drop column if exists access_token;

commit;
