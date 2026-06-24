import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { ExerciseLog, StepTier } from '@/types'

export function getStepTier(steps: number): StepTier {
  if (steps < 5000)  return 'low'
  if (steps < 8000)  return 'normal'
  if (steps < 12000) return 'high'
  return 'very_high'
}

export const STEP_TIER_META: Record<StepTier, { label: string; color: string; bg: string; desc: string }> = {
  low:       { label: '低活动',  color: 'text-gray-500',  bg: 'bg-gray-100',   desc: '< 5,000 步' },
  normal:    { label: '普通',    color: 'text-blue-600',  bg: 'bg-blue-50',    desc: '5,000–8,000 步' },
  high:      { label: '较高',    color: 'text-green-600', bg: 'bg-green-50',   desc: '8,000–12,000 步' },
  very_high: { label: '高活动',  color: 'text-primary-600', bg: 'bg-primary-50', desc: '> 12,000 步' },
}

export const WORKOUT_TYPE_META: Record<string, { label: string; icon: string }> = {
  strength: { label: '力量训练', icon: '🏋️' },
  cardio:   { label: '有氧运动', icon: '🏃' },
  hiit:     { label: 'HIIT',    icon: '⚡' },
  yoga:     { label: '瑜伽',    icon: '🧘' },
  other:    { label: '其他',    icon: '🤸' },
}

export function useExerciseLogs(days = 30) {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .order('date', { ascending: false })
    if (error) setError(error.message)
    else setLogs(data ?? [])
    setLoading(false)
  }, [user, days])

  useEffect(() => { fetch() }, [fetch])

  const saveLog = async (payload: Partial<ExerciseLog> & { date: string }) => {
    if (!user) return
    // 自动计算步数分档
    const steps = payload.steps ?? null
    const step_tier = steps !== null ? getStepTier(steps) : null

    const { data, error } = await supabase
      .from('exercise_logs')
      .upsert(
        { ...payload, user_id: user.id, step_tier },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()
    if (error) throw error

    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.date === payload.date)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [data, ...prev]
    })
    return data
  }

  return { logs, loading, error, saveLog, refetch: fetch }
}
