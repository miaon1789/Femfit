begin;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.food_database'::regclass)
    then raise exception 'Food database RLS is disabled'; end if;
  if (select attempts from public.ai_daily_usage where user_id = '00000000-0000-0000-0000-000000000001') <> 2
    then raise exception 'Existing usage was not preserved'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$
begin
  if (select count(*) from public.users) <> 1 then raise exception 'Profile isolation failed'; end if;
  update public.users set nickname = 'Demo', onboarding_completed = true, birth_year = 1995,
    birth_month = 1, height_cm = 170, weight_kg = 65, target_weight_kg = 60,
    activity_level = 'light', weight_goal_pace = 'slow', cycle_regular = true,
    last_period_date = current_date, avg_cycle_days = 28, avg_period_days = 5,
    updated_at = now() where id = auth.uid();
  if not found then raise exception 'Personal profile updates failed'; end if;
  begin
    update public.users set subscription_tier = 'premium' where id = auth.uid();
    raise exception 'Plan escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.users (id, email, subscription_tier) values (auth.uid(), 'fake@example.test', 'premium');
    raise exception 'Browser profile creation was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.users where id = auth.uid();
    raise exception 'Browser profile deletion was allowed';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.food_database) <> 1 then raise exception 'Food read failed'; end if;
  begin
    update public.food_database set calories = 999;
    raise exception 'Browser food database writes were allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserve_ai_meal_attempt(auth.uid());
    raise exception 'Browser quota RPC was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.ai_daily_usage;
    raise exception 'Browser ledger access was allowed';
  exception when insufficient_privilege then null;
  end;
  -- Reports may be deleted, but deleting one must not reset server usage.
  delete from public.ai_reports where user_id = auth.uid();
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.food_database;
    raise exception 'Anonymous food database access was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000001');
    raise exception 'Anonymous quota RPC was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
insert into public.ai_daily_usage (user_id, usage_date, attempts)
values ('00000000-0000-0000-0000-000000000002', (now() at time zone 'UTC')::date - 1, 3);
-- The signup trigger must still be able to create profiles after the revokes.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000005', 'signup@example.test');
do $$
begin
  if not exists (select 1 from public.users where id = '00000000-0000-0000-0000-000000000005')
    then raise exception 'Signup trigger was broken'; end if;
end;
$$;

set local role service_role;
do $$
declare i integer;
begin
  if not public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000001') then raise exception 'Third slot denied'; end if;
  if public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000001') then raise exception 'Fourth slot allowed'; end if;
  for i in 1..3 loop
    if not public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000002') then raise exception 'New day quota not available'; end if;
  end loop;
  if public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000002') then raise exception 'New day exceeded limit'; end if;
  for i in 1..5 loop
    if not public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000003') then raise exception 'Premium denied'; end if;
  end loop;
end;
$$;

reset role;
commit;
