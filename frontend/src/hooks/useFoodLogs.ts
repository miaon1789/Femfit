import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { MealLog, FoodEntry, MealType } from '@/types'

export interface MealLogWithEntries extends MealLog {
  food_entries: FoodEntry[]
}

export interface AddFoodPayload {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

export function useFoodLogs(date: string) {
  const { user } = useAuthStore()
  const [meals, setMeals] = useState<MealLogWithEntries[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('meal_logs')
      .select('*, food_entries(*)')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true })
    setMeals((data as MealLogWithEntries[]) ?? [])
    setLoading(false)
  }, [user, date])

  useEffect(() => { fetch() }, [fetch])

  const addFoodEntry = async (mealType: MealType, payload: AddFoodPayload) => {
    if (!user) return

    // 查找或创建 meal_log
    let mealLog = meals.find((m) => m.meal_type === mealType)
    if (!mealLog) {
      const { data, error } = await supabase
        .from('meal_logs')
        .insert({ user_id: user.id, date, meal_type: mealType })
        .select()
        .single()
      if (error) throw error
      mealLog = { ...(data as MealLog), food_entries: [] }
    }

    // 插入 food_entry
    const { data: entry, error } = await supabase
      .from('food_entries')
      .insert({
        meal_log_id: mealLog.id,
        food_name: payload.food_name,
        quantity: payload.quantity,
        unit: payload.unit,
        calories: payload.calories,
        protein_g: payload.protein_g ?? 0,
        carbs_g: payload.carbs_g ?? 0,
        fat_g: payload.fat_g ?? 0,
        fiber_g: 0,
        iron_mg: 0,
      })
      .select()
      .single()
    if (error) throw error

    setMeals((prev) => {
      const idx = prev.findIndex((m) => m.meal_type === mealType)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], food_entries: [...next[idx].food_entries, entry as FoodEntry] }
        return next
      }
      return [...prev, { ...mealLog!, food_entries: [entry as FoodEntry] }]
    })
  }

  const deleteFoodEntry = async (entryId: string, mealType: MealType) => {
    if (!user) return
    const { error } = await supabase.from('food_entries').delete().eq('id', entryId)
    if (error) throw error
    setMeals((prev) =>
      prev.map((m) =>
        m.meal_type !== mealType
          ? m
          : { ...m, food_entries: m.food_entries.filter((e) => e.id !== entryId) }
      )
    )
  }

  const totalCalories = Math.round(
    meals.reduce((sum, m) => sum + m.food_entries.reduce((s, e) => s + Number(e.calories), 0), 0)
  )

  const mealCalories = (mealType: MealType) => {
    const m = meals.find((x) => x.meal_type === mealType)
    return m ? Math.round(m.food_entries.reduce((s, e) => s + Number(e.calories), 0)) : 0
  }

  const entriesFor = (mealType: MealType): FoodEntry[] =>
    meals.find((m) => m.meal_type === mealType)?.food_entries ?? []

  return { meals, loading, addFoodEntry, deleteFoodEntry, totalCalories, mealCalories, entriesFor, refetch: fetch }
}
