-- Additive migration: preserves existing food and meal records.
alter table public.food_database add column if not exists name_en text;
alter table public.food_database add column if not exists source text;
alter table public.food_database add column if not exists source_url text;
alter table public.food_database add column if not exists serving_description text;
alter table public.user_foods add column if not exists source text;
alter table public.user_foods add column if not exists source_url text;

create or replace function public.search_foods(search_query text, result_limit integer default 30)
returns setof public.food_database
language sql stable security invoker set search_path = public
as $$
  select f.* from public.food_database f
  where length(trim(search_query)) > 0
    and not exists (
      select 1 from regexp_split_to_table(lower(trim(search_query)), '\s+') token
      where position(token in lower(concat_ws(' ', f.name, f.name_en, array_to_string(f.alias, ' ')))) = 0
    )
  order by
    case when lower(f.name) = lower(trim(search_query)) or lower(f.name_en) = lower(trim(search_query)) then 0
      when lower(trim(search_query)) = any(select lower(a) from unnest(f.alias) a) then 1
      when starts_with(lower(f.name), lower(trim(search_query))) or starts_with(lower(f.name_en), lower(trim(search_query))) then 2
      else 3 end,
    length(f.name), f.name, f.id
  limit greatest(1, least(result_limit, 50));
$$;
revoke all on function public.search_foods(text, integer) from public;
grant execute on function public.search_foods(text, integer) to authenticated;
