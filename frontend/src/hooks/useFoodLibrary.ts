import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { FoodDbItem } from '@/lib/foodSearch'
import type { FoodEntry } from '@/types'

export function useFoodLibrary() {
  const { user } = useAuthStore()
  const [favorites, setFavorites] = useState<FoodDbItem[]>([])
  const [recent, setRecent] = useState<FoodDbItem[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!user) { setFavorites([]); setRecent([]); setLoading(false); return }
    setLoading(true); setError(false)
    const [saved, history] = await Promise.all([
      supabase.from('user_foods').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('meal_logs').select('food_entries(*)').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    ])
    setError(!!saved.error || !!history.error)
    setFavorites((saved.data ?? []).map(f => ({ ...f, name_en: null })))
    const seen = new Set<string>()
    const foods: FoodDbItem[] = []
    for (const meal of history.data ?? []) for (const e of meal.food_entries as FoodEntry[]) {
      const key = `${e.food_name}:${e.unit}`
      if (seen.has(key)) continue
      seen.add(key)
      foods.push({ name: e.food_name, name_en: null, category: '最近', serving_size: Number(e.quantity),
        serving_unit: e.unit, calories: Number(e.calories), protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g),
        fat_g: Number(e.fat_g), fiber_g: Number(e.fiber_g), iron_mg: Number(e.iron_mg) })
    }
    setRecent(foods.slice(0, 30)); setLoading(false)
  }, [user])
  useEffect(() => { void load() }, [load])
  const save = async (food: FoodDbItem) => {
    if (!user) throw new Error('unauthorized')
    const { error } = await supabase.from('user_foods').insert({ user_id: user.id, name: food.name,
      category: food.category, serving_size: food.serving_size, serving_unit: food.serving_unit,
      calories: food.calories, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g,
      fiber_g: food.fiber_g, iron_mg: food.iron_mg, source: food.source ?? null, source_url: food.source_url ?? null })
    if (error) throw error
    await load()
  }
  const remove = async (id: string) => {
    if (!user) throw new Error('unauthorized')
    const { error } = await supabase.from('user_foods').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setFavorites(prev => prev.filter(f => f.id !== id))
  }
  return { favorites, recent, error, loading, save, remove }
}
