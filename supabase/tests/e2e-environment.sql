-- Run ONLY in the separate disposable E2E project, after schema.sql and migrations.
-- This marker authorizes the test runner to create and remove synthetic test users.
create table if not exists public.e2e_test_environment (
  id boolean primary key default true check (id),
  label text not null check (label = 'femfit-e2e-only')
);
alter table public.e2e_test_environment enable row level security;
revoke all on public.e2e_test_environment from anon, authenticated;
grant select on public.e2e_test_environment to service_role;
insert into public.e2e_test_environment (id, label)
values (true, 'femfit-e2e-only') on conflict (id) do nothing;
