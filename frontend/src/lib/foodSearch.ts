import { supabase } from '@/lib/supabase'

export interface FoodDbItem {
  serving_description?: string | null
  id?: string
  source?: string | null
  source_url?: string | null
  alias?: string[] | null
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

export async function searchFoodDatabase(query: string, limit = 30): Promise<FoodDbItem[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase.rpc('search_foods', { search_query: q, result_limit: limit })
  if (error) throw error
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

