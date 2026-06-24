import type { Context } from 'hono'

/**
 * Hono 应用的环境类型：声明经 authMiddleware 注入到 context 的变量，
 * 让路由里的 c.get('userId') 拥有正确类型（而非 unknown）。
 */
export type AppEnv = {
  Variables: {
    userId: string
    userEmail: string
  }
}

export type AppContext = Context<AppEnv>
