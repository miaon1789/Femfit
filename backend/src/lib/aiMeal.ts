import { z } from 'zod'

const nutrient = z.number().finite().nonnegative()

export const MealResultSchema = z.object({
  foods: z.array(z.object({
    food_name: z.string().trim().min(1),
    quantity: z.number().finite().positive(),
    unit: z.string().trim().min(1),
    calories: nutrient,
    protein_g: nutrient,
    carbs_g: nutrient,
    fat_g: nutrient,
    fiber_g: nutrient,
    iron_mg: nutrient,
  })),
  total_calories: nutrient,
  cycle_tip: z.string(),
})

export class InvalidAIResponse extends Error {
  constructor(readonly issues: Array<{ path: PropertyKey[]; code: string }> = []) {
    super('AI response did not match the meal contract')
    this.name = 'InvalidAIResponse'
  }
}

/** Parse provider text without treating untrusted JSON as a typed result. */
export function parseAIJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    const candidate = fence ? fence[1].trim() : trimmed
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) throw new InvalidAIResponse()
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      throw new InvalidAIResponse()
    }
  }
}

export function parseMealResult(text: string): z.infer<typeof MealResultSchema> {
  const result = MealResultSchema.safeParse(parseAIJson(text))
  if (!result.success) {
    throw new InvalidAIResponse(result.error.issues.map(({ path, code }) => ({ path, code })))
  }
  const total = result.data.foods.reduce((sum, food) => sum + food.calories, 0)
  if (!Number.isFinite(total)) throw new InvalidAIResponse([{ path: ['total_calories'], code: 'not_finite' }])
  return { ...result.data, total_calories: Number(total.toFixed(2)) }
}
