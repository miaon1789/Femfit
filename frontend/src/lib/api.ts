import { supabase } from '@/lib/supabase'
import type { MealType } from '@/types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:3000'

/**
 * 带 Supabase JWT 的后端请求封装。
 * 后端 authMiddleware 会校验该 token 并注入 userId。
 */
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
}

export interface AIAnalyzedFood {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  iron_mg: number
}

export interface AIMealResult {
  foods: AIAnalyzedFood[]
  total_calories: number
  cycle_tip: string
  report_id?: string
}

/**
 * 自然语言饮食分析。例如 "中午吃了一碗兰州拉面加一个鸡蛋"。
 * 失败时抛出带后端错误信息的 Error（含限流 429 文案）。
 */
export async function analyzeMeal(input: {
  description: string
  meal_type: MealType
  date?: string
  locale?: 'en' | 'zh'
}): Promise<AIMealResult> {
  const res = await authedFetch('/api/ai/analyze-meal', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `AI 分析失败（${res.status}）`)
  }
  return res.json() as Promise<AIMealResult>
}
