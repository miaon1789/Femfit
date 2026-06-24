/**
 * seed-foods.mjs —— 把 food_database.json 灌入 Supabase 的全局食物库。
 *
 * 幂等：先清空 food_database 再批量插入，可重复运行。
 * 用法：
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed/seed-foods.mjs
 * 或在 backend/ 下加载 .env 后运行。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(readFileSync(join(__dirname, 'food_database.json'), 'utf-8'))

// PostgREST 批量插入要求每个对象字段完全一致：补齐所有列的默认值。
const foods = raw.map((f) => ({
  name: f.name,
  name_en: f.name_en ?? f.name,
  alias: f.alias ?? [],
  category: f.category,
  serving_size: f.serving_size ?? 100,
  serving_unit: f.serving_unit ?? 'g',
  calories: f.calories,
  protein_g: f.protein_g ?? 0,
  carbs_g: f.carbs_g ?? 0,
  fat_g: f.fat_g ?? 0,
  fiber_g: f.fiber_g ?? 0,
  iron_mg: f.iron_mg ?? 0,
}))

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function main() {
  console.log(`📦 准备灌入 ${foods.length} 条食物数据…`)

  // 1) 清空旧数据（幂等）
  const del = await fetch(`${SUPABASE_URL}/rest/v1/food_database?id=not.is.null`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  })
  if (!del.ok) throw new Error(`清空失败 ${del.status}: ${await del.text()}`)
  console.log('🧹 已清空旧数据')

  // 2) 批量插入
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/food_database`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(foods),
  })
  if (!ins.ok) throw new Error(`插入失败 ${ins.status}: ${await ins.text()}`)

  // 3) 核对数量
  const cnt = await fetch(`${SUPABASE_URL}/rest/v1/food_database?select=id`, {
    method: 'HEAD',
    headers: { ...headers, Prefer: 'count=exact' },
  })
  const range = cnt.headers.get('content-range') ?? '?'
  console.log(`✅ 完成，content-range=${range}（应为 */${foods.length}）`)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
