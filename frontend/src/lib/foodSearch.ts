import { supabase } from '@/lib/supabase'

export interface FoodDbItem {
  name: string
  name_en: string | null
  category: string
  serving_size: number
  serving_unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  iron_mg: number
}

/**
 * 在全局食物库里按名称/别名做子串搜索。
 * 用 ilike 子串匹配（对中文有效），别名数组用 contains 兜底。
 */
export async function searchFoodDatabase(query: string, limit = 20): Promise<FoodDbItem[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from('food_database')
    .select('name,name_en,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg')
    .or(`name.ilike.%${q}%,name_en.ilike.%${q}%,alias.cs.{${q}}`)
    .limit(limit)

  if (error) {
    console.error('food search error:', error)
    return []
  }
  return (data as FoodDbItem[]) ?? []
}

/** 食物分类（库里以中文存储）→ i18n key，用于按当前语言显示分类标签。 */
export const FOOD_CATEGORY_KEY: Record<string, string> = {
  '主食': 'food.catStaple',
  '肉蛋': 'food.catProtein',
  '豆制品': 'food.catSoy',
  '蔬菜': 'food.catVeg',
  '水果': 'food.catFruit',
  '奶制品': 'food.catDairy',
  '坚果': 'food.catNuts',
  '饮品': 'food.catDrink',
  '外食': 'food.catEatingOut',
  '调味': 'food.catCondiment',
  '亚洲': 'food.catAsian',
}

