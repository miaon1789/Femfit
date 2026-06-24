import type { Context, Next } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { AppEnv } from '../types.js'

/**
 * 从请求头中提取并验证 Supabase JWT，将 userId 注入 context。
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '未授权' }, 401)
  }
  const token = authHeader.slice(7)

  // 用 anon key 验证用户 token（不用 service key）
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await client.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: '无效的认证令牌' }, 401)
  }

  c.set('userId', user.id)
  c.set('userEmail', user.email ?? '')
  await next()
}
