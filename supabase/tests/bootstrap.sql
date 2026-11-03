-- Only for the empty local femfit_test database, never a hosted project.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text not null);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$ select current_user::text; $$;
grant usage on schema auth, public to anon, authenticated, service_role;
-- Match Supabase's broad initial grants so the migration must narrow them.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
