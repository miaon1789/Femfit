import { supabase } from '@/lib/supabase'
import type { MealType } from '@/types'
import type { MealPhotoInput } from './mealPhoto'

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

type MealErrorKey = 'food.aiFailed' | 'food.aiDailyLimit' | 'food.aiInvalidResponse' | 'food.aiSignIn' | 'food.aiQuotaUnavailable'
  | 'food.photoTooLarge' | 'food.photoFailed' | 'food.errDescribe' | 'food.aiInputInvalid'

export class MealAnalysisError extends Error {
  constructor(readonly translationKey: MealErrorKey) {
    super(translationKey)
  }
}

export function getMealAnalysisErrorKey(error: unknown): MealErrorKey {
  return error instanceof MealAnalysisError ? error.translationKey : 'food.aiFailed'
}

/** Analyze a meal, exposing stable translation keys instead of server prose. */
export async function analyzeMeal(input: {
  description: string
  image?: MealPhotoInput
  meal_type: MealType
  date?: string
  locale?: 'en' | 'zh'
}, signal?: AbortSignal): Promise<AIMealResult> {
  const res = await authedFetch('/api/ai/analyze-meal', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error
    const key: MealErrorKey = res.status === 413 ? 'food.photoTooLarge'
      : res.status === 429 ? 'food.aiDailyLimit'
      : res.status === 401 ? 'food.aiSignIn'
      : code === 'ai_invalid_image' ? 'food.photoFailed'
      : code === 'ai_meal_input_required' ? 'food.errDescribe'
      : code === 'ai_invalid_input' ? 'food.aiInputInvalid'
      : code === 'ai_quota_unavailable' ? 'food.aiQuotaUnavailable'
      : code === 'ai_invalid_response' ? 'food.aiInvalidResponse'
      : 'food.aiFailed'
    throw new MealAnalysisError(key)
  }
  return res.json() as Promise<AIMealResult>
}
