import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()

app.use('*', authMiddleware)

const AI_DAILY_LIMIT = 3  // 免费用户每日 3 次

// 检查并记录 AI 调用次数（防止滥用）
async function checkRateLimit(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('ai_reports')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('generated_at', `${today}T00:00:00Z`)

  // 获取用户套餐
  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  if (user?.subscription_tier === 'premium') return true
  return (count ?? 0) < AI_DAILY_LIMIT
}

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

/** 按语言构建饮食分析 prompt（英文模式要求英文输出）。 */
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
 * 自然语言饮食分析
 */
app.post('/analyze-meal', zValidator('json', MealAnalysisSchema), async (c) => {
  const userId = c.get('userId')

  const allowed = await checkRateLimit(userId)
  if (!allowed) {
    return c.json({
      error: '今日 AI 分析次数已用完（免费版每日 3 次），请明天再试或升级高级版。'
    }, 429)
  }

  const { description, meal_type, date, locale } = c.req.valid('json')

  // 获取用户当前周期阶段信息（用于 AI prompt）
  const { data: user } = await supabase
    .from('users')
    .select('last_period_date, avg_cycle_days, avg_period_days')
    .eq('id', userId)
    .single()

  const prompt = buildMealPrompt(description, user, locale ?? 'en')

  try {
    const aiResponse = await callAI(prompt)
    const parsed = parseAIJson(aiResponse)

    // 存储 AI 分析结果
    const { data: report } = await supabase
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

    return c.json({ ...parsed, report_id: report?.id })
  } catch (err) {
    console.error('AI analysis error:', err)
    return c.json({ error: 'AI 分析失败，请重试' }, 500)
  }
})

/**
 * 健壮地从 AI 返回中解析 JSON。
 * 大模型常把 JSON 包进 ```json``` 代码块或加少量说明文字，
 * 直接 JSON.parse 会失败——这里先剥离代码块、再回退到首个 {…最后一个 }。
 */
function parseAIJson<T = Record<string, unknown>>(text: string): T {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) t = fence[1].trim()
  if (!t.startsWith('{')) {
    const s = t.indexOf('{')
    const e = t.lastIndexOf('}')
    if (s >= 0 && e > s) t = t.slice(s, e + 1)
  }
  return JSON.parse(t) as T
}

/**
 * 统一 AI 调用封装——根据环境变量选择服务商
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
