import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { WeightLog } from '@/types'

export function useWeightLogs(days: number = 90) {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .order('date', { ascending: true })
    if (error) setError(error.message)
    else setLogs(data ?? [])
    setLoading(false)
  }, [user, days])

  useEffect(() => { fetch() }, [fetch])

  const addLog = async (weightKg: number, date?: string) => {
    if (!user) return
    const logDate = date ?? new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: user.id, date: logDate, weight_kg: weightKg },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()
    if (error) throw error
    // 更新本地状态
    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.date === logDate)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [...prev, data].sort((a, b) => a.date.localeCompare(b.date))
    })
    return data
  }

  const deleteLog = async (id: string) => {
    const { error } = await supabase.from('weight_logs').delete().eq('id', id)
    if (error) throw error
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  return { logs, loading, error, addLog, deleteLog, refetch: fetch }
}
