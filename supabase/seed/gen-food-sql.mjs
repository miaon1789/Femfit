/**
 * gen-food-sql.mjs —— 从 food_database.json 生成自带 ALTER 的完整 SQL 种子文件。
 *
 * 用途：在 Supabase SQL Editor 里一次性执行 food_database.sql，即可
 *   1) 给 food_database 加 name_en 列（幂等）
 *   2) 清空并灌入全部食物（含中英文名）
 * 这样无需后端 service key 也能完成加列 + 扩充。
 *
 * 运行：node supabase/seed/gen-food-sql.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(readFileSync(join(__dirname, 'food_database.json'), 'utf-8'))

const esc = (s) => String(s).replace(/'/g, "''")
const arr = (a) => `ARRAY[${(a ?? []).map((x) => `'${esc(x)}'`).join(', ')}]::text[]`

const rows = raw.map((f) => {
  const ss = f.serving_size ?? 100
  const su = esc(f.serving_unit ?? 'g')
  return `  ('${esc(f.name)}', '${esc(f.name_en ?? f.name)}', ${arr(f.alias)}, '${esc(f.category)}', ` +
    `${ss}, '${su}', ${f.calories}, ${f.protein_g ?? 0}, ${f.carbs_g ?? 0}, ${f.fat_g ?? 0}, ` +
    `${f.fiber_g ?? 0}, ${f.iron_mg ?? 0})`
})

const sql = `-- FemFit food database seed (generated from food_database.json — do not edit by hand)
-- Run once in the Supabase SQL Editor.

alter table public.food_database add column if not exists name_en text;
create index if not exists food_db_name_en_idx
  on public.food_database using gin (to_tsvector('simple', coalesce(name_en, '')));

delete from public.food_database;

insert into public.food_database
  (name, name_en, alias, category, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, iron_mg)
values
${rows.join(',\n')};
`

writeFileSync(join(__dirname, 'food_database.sql'), sql)
console.log(`wrote food_database.sql with ${raw.length} rows`)
