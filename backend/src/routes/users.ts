import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()

app.use('*', authMiddleware)

// GET /api/users/me
app.get('/me', async (c) => {
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

const UpdateProfileSchema = z.object({
  nickname: z.string().min(1).max(20).optional(),
  height_cm: z.number().min(140).max(220).optional(),
  weight_kg: z.number().min(30).max(200).optional(),
  target_weight_kg: z.number().min(30).max(200).optional(),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'heavy']).optional(),
  weight_goal_pace: z.enum(['slow', 'moderate', 'fast']).optional(),
  cycle_regular: z.boolean().optional(),
  last_period_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  avg_cycle_days: z.number().int().min(20).max(45).optional(),
  avg_period_days: z.number().int().min(2).max(10).optional(),
})

// PATCH /api/users/me
app.patch('/me', zValidator('json', UpdateProfileSchema), async (c) => {
  const userId = c.get('userId')
  const updates = c.req.valid('json')
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

// DELETE /api/users/me  — 账号注销
app.delete('/me', async (c) => {
  const userId = c.get('userId')
  // 删除所有用户数据（RLS 已保证隔离，service key 可以操作）
  const tables = ['weight_logs', 'measurement_logs', 'period_logs', 'meal_logs', 'food_entries', 'ai_reports', 'user_foods']
  for (const table of tables) {
    await supabase.from(table).delete().eq('user_id', userId)
  }
  await supabase.from('users').delete().eq('id', userId)
  await supabase.auth.admin.deleteUser(userId)
  return c.json({ message: '账号已注销' })
})

export default app
