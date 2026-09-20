import { z } from 'zod'

const number = z.coerce.number().finite().nonnegative()
const optionalNumber = z.preprocess(v => v === null || v === '' ? undefined : v, number.optional())
const product = z.object({
  code: z.string(), product_name: z.string().optional(), brands: z.string().optional(), product_quantity_unit: z.string().optional(),
  nutriments: z.record(z.unknown()),
})
export function normalizeOFF(raw: unknown) {
  const parsed = product.safeParse(raw)
  if (!parsed.success) return null
  const p = parsed.data
  const kcal = optionalNumber.safeParse(p.nutriments['energy-kcal_100g'])
  const kj = optionalNumber.safeParse(p.nutriments['energy_100g'])
  const energy = kcal.success ? kcal.data : undefined
  const calories = energy ?? (kj.success && kj.data !== undefined ? kj.data / 4.184 : undefined)
  if (!p.product_name || calories === undefined) return null
  const n = (key: string) => {
    const value = optionalNumber.safeParse(p.nutriments[key + '_100g'])
    return value.success ? value.data ?? 0 : 0
  }
  return { name: [p.product_name, p.brands].filter(Boolean).join(' · '), name_en: p.product_name,
    category: '包装食品', serving_size: 100, serving_unit: p.product_quantity_unit === 'ml' ? 'ml' : 'g', calories: Math.round(calories),
    protein_g: n('proteins'), carbs_g: n('carbohydrates'), fat_g: n('fat'), fiber_g: n('fiber'), iron_mg: 0,
    source: 'Open Food Facts', source_url: `https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}` }
}
const usdaFood = z.object({ fdcId: z.number(), description: z.string(),
  foodNutrients: z.array(z.object({ nutrientId: z.number(), unitName: z.string(), value: optionalNumber })).default([]) })
export function normalizeUSDA(raw: unknown) {
  const parsed = usdaFood.safeParse(raw)
  if (!parsed.success) return null
  const p = parsed.data
  const value = (id: number, unit: string) => p.foodNutrients.find(n => n.nutrientId === id && n.unitName.toLowerCase() === unit)?.value
  const calories = value(1008, 'kcal') ?? value(2047, 'kcal') ?? value(2048, 'kcal')
  if (calories === undefined) return null
  return { name: p.description, name_en: p.description, category: '食材', serving_size: 100, serving_unit: 'g',
    calories: Math.round(calories), protein_g: value(1003, 'g') ?? 0, carbs_g: value(1005, 'g') ?? 0,
    fat_g: value(1004, 'g') ?? 0, fiber_g: value(1079, 'g') ?? 0, iron_mg: value(1089, 'mg') ?? 0,
    source: 'USDA FoodData Central', source_url: `https://fdc.nal.usda.gov/food-details/${p.fdcId}/nutrients` }
}
