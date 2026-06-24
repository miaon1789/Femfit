import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { MeasurementLog } from '@/types'

export function useMeasurementLogs(days = 90) {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<MeasurementLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('measurement_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .order('date', { ascending: false })
    if (error) setError(error.message)
    else setLogs(data ?? [])
    setLoading(false)
  }, [user, days])

  useEffect(() => { fetch() }, [fetch])

  const saveLog = async (payload: Partial<MeasurementLog> & { date: string }) => {
    if (!user) return
    const { data, error } = await supabase
      .from('measurement_logs')
      .upsert(
        { ...payload, user_id: user.id },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()
    if (error) throw error
    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.date === payload.date)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = data
        return next
      }
      return [data, ...prev]
    })
    return data
  }

  return { logs, loading, error, saveLog, refetch: fetch }
}
