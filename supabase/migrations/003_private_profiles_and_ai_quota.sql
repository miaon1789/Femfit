-- Run before deploying the updated backend and frontend.
-- Profile creation stays in the auth.users signup trigger. Browser clients may
-- update personal fields, but cannot set their own plan or recreate a profile.
begin;

drop policy if exists "users: self access" on public.users;
create policy "users: self read" on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy "users: self update" on public.users
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.users from public, anon, authenticated;
-- Remove any older column grants as well as table-level grants.
do $$
declare col record;
begin
  for col in select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
  loop
    execute format('revoke all (%I) on public.users from public, anon, authenticated', col.column_name);
  end loop;
end;
$$;
grant select on public.users to authenticated;
grant update (nickname, birth_year, birth_month, height_cm, weight_kg,
  target_weight_kg, activity_level, weight_goal_pace, cycle_regular,
  last_period_date, avg_cycle_days, avg_period_days, onboarding_completed, updated_at)
  on public.users to authenticated;
grant all on public.users to service_role;

alter table public.food_database enable row level security;
revoke all on public.food_database from public, anon, authenticated;
grant select on public.food_database to authenticated;
grant all on public.food_database to service_role;

-- This ledger is independent of editable/deletable AI reports. Free users pay
-- one slot per authorized attempt, even if the provider or report save fails.
create table public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  attempts integer not null check (attempts between 1 and 3),
  primary key (user_id, usage_date)
);
alter table public.ai_daily_usage enable row level security;
revoke all on public.ai_daily_usage from public, anon, authenticated;
grant all on public.ai_daily_usage to service_role;

-- Keep today's existing usage when upgrading. Future attempts use the ledger.
insert into public.ai_daily_usage (user_id, usage_date, attempts)
select user_id, (generated_at at time zone 'UTC')::date, least(count(*), 3)::integer
from public.ai_reports
where generated_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
group by user_id, (generated_at at time zone 'UTC')::date;

create function public.reserve_ai_meal_attempt(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  tier text;
  reserved integer;
  today_utc date := (clock_timestamp() at time zone 'UTC')::date;
begin
  select subscription_tier into tier from public.users where id = p_user_id;
  if not found then raise exception 'Profile not found'; end if;
  if tier = 'premium' then return true; end if;

  insert into public.ai_daily_usage as usage (user_id, usage_date, attempts)
  values (p_user_id, today_utc, 1)
  on conflict (user_id, usage_date) do update
    set attempts = usage.attempts + 1
    where usage.attempts < 3
  returning attempts into reserved;

  return reserved is not null;
end;
$$;
revoke all on function public.reserve_ai_meal_attempt(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_meal_attempt(uuid) to service_role;

commit;
