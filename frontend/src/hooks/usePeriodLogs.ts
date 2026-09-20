import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import type { PeriodLog } from '@/types'

export function usePeriodLogs() {
  const { user } = useAuthStore()
  const { setProfile } = useUserStore()
  const [logs, setLogs] = useState<PeriodLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('period_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(12)
    if (error) setError(error.message)
    else setLogs(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const addPeriod = async (payload: {
    start_date: string
    end_date?: string | null
    flow_level?: 1 | 2 | 3 | null
    pain_level?: 1 | 2 | 3 | null
    notes?: string | null
  }) => {
    if (!user) return
    const { data, error } = await supabase
      .from('period_logs')
      .insert({ ...payload, user_id: user.id })
      .select()
      .single()
    if (error) throw error

    // 补录历史记录后仍按开始日期倒序，保证 logs[0] 始终是最近一次。
    setLogs((prev) => [data, ...prev].sort((a, b) => b.start_date.localeCompare(a.start_date)))

    // 在数据库中比较日期，避免空列表、补录或并发写入把周期起点倒退。
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .update({ last_period_date: payload.start_date })
      .eq('id', user.id)
      .or(`last_period_date.is.null,last_period_date.lt.${payload.start_date}`)
      .select()
      .maybeSingle()
    if (profileError) throw profileError
    if (profile) setProfile(profile)

    return data
  }

  const updatePeriod = async (id: string, payload: Partial<Pick<PeriodLog, 'end_date' | 'flow_level' | 'pain_level' | 'notes'>>) => {
    if (!user) return
    const { data, error } = await supabase
      .from('period_logs')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw error
    setLogs((prev) => prev.map((l) => (l.id === id ? data : l)))
    return data
  }

  return { logs, loading, error, addPeriod, updatePeriod, refetch: fetch }
}
