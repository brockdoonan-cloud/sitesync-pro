-- Roll back national coverage reference data.

begin;

drop policy if exists "us_states_public_select" on public.us_states;
drop policy if exists "us_states_super_admin_write" on public.us_states;
drop table if exists public.us_states;

commit;
