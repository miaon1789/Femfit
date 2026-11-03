insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'premium@example.test'),
  ('00000000-0000-0000-0000-000000000006', 'concurrent@example.test');
update public.users set subscription_tier = 'premium' where id = '00000000-0000-0000-0000-000000000003';
insert into public.ai_reports (user_id, type, content) values
  ('00000000-0000-0000-0000-000000000001', 'meal_analysis', '{}'),
  ('00000000-0000-0000-0000-000000000001', 'meal_analysis', '{}');
insert into public.food_database (name, category, calories) values ('Demo rice', 'demo', 100);
-- An older explicit column grant must also be removed.
grant update (subscription_tier) on public.users to authenticated;
