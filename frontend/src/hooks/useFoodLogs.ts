import { useState, useEffect, useCallback, useRef } from 'react'
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
  const userId = user?.id
  const key = `${userId ?? ''}:${date}`
  const [result, setResult] = useState<{
    key: string; meals: MealLogWithEntries[]; loading: boolean; error: string | null
  }>({ key, meals: [], loading: !!userId, error: null })
  const request = useRef(0)
  const current = result.key === key
  const meals = current ? result.meals : []
  const loading = current ? result.loading : !!userId
  const error = current ? result.error : null
  const setMeals = (update: (meals: MealLogWithEntries[]) => MealLogWithEntries[]) => {
    setResult(prev => prev.key === key ? { ...prev, meals: update(prev.meals) } : prev)
  }

  const fetch = useCallback(async () => {
    const version = ++request.current
    if (!userId) {
      setResult({ key, meals: [], loading: false, error: null })
      return
    }
    setResult(prev => ({ key, meals: prev.key === key ? prev.meals : [], loading: true, error: null }))
    try {
      const { data, error: readError } = await supabase
        .from('meal_logs')
        .select('*, food_entries(*)')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (readError) throw readError
      if (version === request.current) setResult({ key, meals: (data as MealLogWithEntries[]) ?? [], loading: false, error: null })
    } catch {
      if (version === request.current) setResult(prev => ({ ...prev, loading: false, error: 'food.loadFailed' }))
    }
  }, [userId, date, key])

  useEffect(() => {
    void fetch()
    return () => { request.current++ }
  }, [fetch])

  const addFoodEntries = async (mealType: MealType, payloads: AddFoodPayload[]) => {
    if (!user) throw new Error('unauthorized')
    if (!payloads.length) return
    // Read the current meal from the server: sequential AI/bulk saves must not use stale React state.
    const { data: existing, error: lookupError } = await supabase.from('meal_logs').select('*')
      .eq('user_id', user.id).eq('date', date).eq('meal_type', mealType).order('created_at').limit(1).maybeSingle()
    if (lookupError) throw lookupError
    let mealLog = existing as MealLog | null
    if (!mealLog) {
      const { data, error } = await supabase.from('meal_logs')
        .insert({ user_id: user.id, date, meal_type: mealType }).select().single()
      if (error) throw error
      mealLog = data as MealLog
    }
    const { data: entries, error } = await supabase.from('food_entries').insert(payloads.map(payload => ({
      meal_log_id: mealLog!.id, food_name: payload.food_name, quantity: payload.quantity, unit: payload.unit,
      calories: payload.calories, protein_g: payload.protein_g ?? 0, carbs_g: payload.carbs_g ?? 0,
      fat_g: payload.fat_g ?? 0, fiber_g: 0, iron_mg: 0,
    }))).select()
    if (error) throw error
    setMeals(prev => {
      const idx = prev.findIndex(m => m.id === mealLog!.id)
      if (idx < 0) return [...prev, { ...mealLog!, food_entries: entries as FoodEntry[] }]
      return prev.map((m, i) => i === idx ? { ...m, food_entries: [...m.food_entries, ...entries as FoodEntry[]] } : m)
    })
  }
  const addFoodEntry = (mealType: MealType, payload: AddFoodPayload) => addFoodEntries(mealType, [payload])

  const copyPreviousMeal = async (mealType: MealType): Promise<boolean> => {
    if (!user) throw new Error('unauthorized')
    const { data, error } = await supabase.from('meal_logs').select('*, food_entries!inner(*)')
      .eq('user_id', user.id).eq('meal_type', mealType).lt('date', date)
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    if (!data) return false
    await addFoodEntries(mealType, (data.food_entries as FoodEntry[]).map(e => ({
      food_name: e.food_name, quantity: Number(e.quantity), unit: e.unit, calories: Number(e.calories),
      protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g), fat_g: Number(e.fat_g),
    })))
    return true
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

  const entriesFor = (mealType: MealType): FoodEntry[] =>
    meals.filter(m => m.meal_type === mealType).flatMap(m => m.food_entries)
  const mealCalories = (mealType: MealType) => Math.round(entriesFor(mealType).reduce((sum, e) => sum + Number(e.calories), 0))

  return { meals, loading, error, addFoodEntry, addFoodEntries, copyPreviousMeal, deleteFoodEntry, totalCalories, mealCalories, entriesFor, refetch: fetch }
}
