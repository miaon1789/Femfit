import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'
import { InvalidAIResponse, parseMealResult } from '../lib/aiMeal.js'

const app = new Hono<AppEnv>()

app.use('*', authMiddleware)

const MealAnalysisSchema = z.object({
  description: z.string().min(1).max(500),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locale: z.enum(['en', 'zh']).optional(),
})

interface CycleUser {
  last_period_date: string | null
  avg_cycle_days: number | null
  avg_period_days: number | null
}

/** Build the meal prompt in the user's selected language. */
function buildMealPrompt(description: string, user: CycleUser | null, locale: 'en' | 'zh'): string {
  if (locale === 'en') {
    const cycleContext = user?.last_period_date
      ? `The user's current cycle info: last period start ${user.last_period_date}, average cycle ${user.avg_cycle_days} days, average period ${user.avg_period_days} days.`
      : ''
    return `You are a professional dietitian who helps women analyze the calories and macros of their meals.

${cycleContext}

The user described a meal: "${description}"

Analyze it and return JSON in exactly this shape:
{
  "foods": [
    { "food_name": "food name", "quantity": number, "unit": "g/ml/piece/bowl/etc.", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "iron_mg": number }
  ],
  "total_calories": number,
  "cycle_tip": "a short tip (<= 20 words) tied to the user's current cycle phase; empty string if the phase can't be inferred"
}

Notes:
- Estimate using common standard serving sizes.
- All numeric fields must be numbers, not strings.
- Calories should not be below 100 kcal unless it's clearly a tiny bite.
- Return JSON only, no other text.`
  }

  const cycleContext = user?.last_period_date
    ? `用户当前月经周期信息：上次月经开始日期 ${user.last_period_date}，平均周期 ${user.avg_cycle_days} 天，平均经期 ${user.avg_period_days} 天。`
    : ''
  return `你是一位专业的营养师，专门帮助女性用户分析饮食热量和营养素。

${cycleContext}

用户描述了一餐食物：「${description}」

请分析这餐食物，以 JSON 格式返回：
{
  "foods": [
    { "food_name": "食物名称", "quantity": 数量, "unit": "单位（g/ml/个/碗等）", "calories": 热量, "protein_g": 蛋白质, "carbs_g": 碳水化合物, "fat_g": 脂肪, "fiber_g": 膳食纤维, "iron_mg": 铁 }
  ],
  "total_calories": 总热量,
  "cycle_tip": "结合用户当前周期阶段的简短建议（30字以内，无法判断周期时留空字符串）"
}

注意：
- 基于常见中式食物的标准份量估算
- 所有数字字段必须是数字类型，不能是字符串
- 热量不能低于100kcal（除非明确是一小口）
- 只返回 JSON，不要包含其他文字`
}

/**
 * POST /api/ai/analyze-meal
 * Analyze a natural-language meal description.
 */
app.post('/analyze-meal', zValidator('json', MealAnalysisSchema), async (c) => {
  const userId = c.get('userId')

  // A service-only RPC reserves quota atomically before contacting the provider.
  const { data: allowed, error: quotaError } = await supabase.rpc('reserve_ai_meal_attempt', { p_user_id: userId })
  if (quotaError || typeof allowed !== 'boolean') {
    console.error('AI quota reservation failed')
    return c.json({ error: 'ai_quota_unavailable' }, 503)
  }
  if (!allowed) {
    return c.json({
      error: 'ai_daily_limit'
    }, 429)
  }

  const { description, meal_type, date, locale } = c.req.valid('json')

  // Fetch cycle context for the prompt.
  const { data: user } = await supabase
    .from('users')
    .select('last_period_date, avg_cycle_days, avg_period_days')
    .eq('id', userId)
    .single()

  const prompt = buildMealPrompt(description, user, locale ?? 'en')

  try {
    const aiResponse = await callAI(prompt)
    const parsed = parseMealResult(aiResponse)

    // Persist only validated data with the server-calculated calorie total.
    const { data: report, error: saveError } = await supabase
      .from('ai_reports')
      .insert({
        user_id: userId,
        type: 'meal_analysis',
        content: JSON.stringify(parsed),
        generated_at: new Date().toISOString(),
        metadata: { description, meal_type, date }
      })
      .select()
      .single()

    if (saveError || !report) {
      console.error('AI report persistence failed')
      return c.json({ error: 'ai_report_save_failed' }, 500)
    }
    return c.json({ ...parsed, report_id: report?.id })
  } catch (err) {
    if (err instanceof InvalidAIResponse) {
      // Log field paths and issue codes, without meal text or health data.
      console.error('Invalid AI meal response:', err.issues)
      return c.json({ error: 'ai_invalid_response' }, 502)
    }
    console.error('AI analysis failed')
    return c.json({ error: 'ai_analysis_failed' }, 502)
  }
})

/**
 * Select the provider through server-side configuration.
 */
async function callAI(prompt: string): Promise<string> {
  const provider = process.env.AI_PROVIDER ?? 'claude'

  if (provider === 'claude') {
    return callClaude(prompt)
  } else if (provider === 'openai') {
    return callOpenAI(prompt)
  }
  throw new Error(`Unknown AI provider: ${provider}`)
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json() as { content: Array<{ text: string }> }
  return data.content[0].text
}

async function callOpenAI(prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

export default app
