-- National coverage reference data for operator service-area setup.

begin;

create table if not exists public.us_states (
  state_code text primary key check (state_code ~ '^[A-Z]{2}$'),
  state_name text not null,
  region text not null,
  created_at timestamptz not null default now()
);

insert into public.us_states (state_code, state_name, region)
values
  ('AL', 'Alabama', 'Southeast'),
  ('AK', 'Alaska', 'West'),
  ('AZ', 'Arizona', 'Southwest'),
  ('AR', 'Arkansas', 'South'),
  ('CA', 'California', 'West'),
  ('CO', 'Colorado', 'West'),
  ('CT', 'Connecticut', 'Northeast'),
  ('DE', 'Delaware', 'Northeast'),
  ('FL', 'Florida', 'Southeast'),
  ('GA', 'Georgia', 'Southeast'),
  ('HI', 'Hawaii', 'West'),
  ('ID', 'Idaho', 'West'),
  ('IL', 'Illinois', 'Midwest'),
  ('IN', 'Indiana', 'Midwest'),
  ('IA', 'Iowa', 'Midwest'),
  ('KS', 'Kansas', 'Midwest'),
  ('KY', 'Kentucky', 'South'),
  ('LA', 'Louisiana', 'South'),
  ('ME', 'Maine', 'Northeast'),
  ('MD', 'Maryland', 'Northeast'),
  ('MA', 'Massachusetts', 'Northeast'),
  ('MI', 'Michigan', 'Midwest'),
  ('MN', 'Minnesota', 'Midwest'),
  ('MS', 'Mississippi', 'South'),
  ('MO', 'Missouri', 'Midwest'),
  ('MT', 'Montana', 'West'),
  ('NE', 'Nebraska', 'Midwest'),
  ('NV', 'Nevada', 'West'),
  ('NH', 'New Hampshire', 'Northeast'),
  ('NJ', 'New Jersey', 'Northeast'),
  ('NM', 'New Mexico', 'Southwest'),
  ('NY', 'New York', 'Northeast'),
  ('NC', 'North Carolina', 'Southeast'),
  ('ND', 'North Dakota', 'Midwest'),
  ('OH', 'Ohio', 'Midwest'),
  ('OK', 'Oklahoma', 'South'),
  ('OR', 'Oregon', 'West'),
  ('PA', 'Pennsylvania', 'Northeast'),
  ('RI', 'Rhode Island', 'Northeast'),
  ('SC', 'South Carolina', 'Southeast'),
  ('SD', 'South Dakota', 'Midwest'),
  ('TN', 'Tennessee', 'South'),
  ('TX', 'Texas', 'Southwest'),
  ('UT', 'Utah', 'West'),
  ('VT', 'Vermont', 'Northeast'),
  ('VA', 'Virginia', 'Southeast'),
  ('WA', 'Washington', 'West'),
  ('WV', 'West Virginia', 'South'),
  ('WI', 'Wisconsin', 'Midwest'),
  ('WY', 'Wyoming', 'West'),
  ('DC', 'District of Columbia', 'Northeast'),
  ('PR', 'Puerto Rico', 'Territory'),
  ('VI', 'U.S. Virgin Islands', 'Territory'),
  ('GU', 'Guam', 'Territory'),
  ('MP', 'Northern Mariana Islands', 'Territory'),
  ('AS', 'American Samoa', 'Territory')
on conflict (state_code) do update
set state_name = excluded.state_name,
    region = excluded.region;

create index if not exists us_states_region_idx
  on public.us_states (region);

alter table public.us_states enable row level security;

drop policy if exists "us_states_public_select" on public.us_states;
drop policy if exists "us_states_super_admin_write" on public.us_states;

create policy "us_states_public_select"
  on public.us_states for select
  using (true);

create policy "us_states_super_admin_write"
  on public.us_states for all
  using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

commit;
