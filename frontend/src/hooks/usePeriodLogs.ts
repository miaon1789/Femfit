import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import type { PeriodLog } from '@/types'

export type PeriodPayload = Pick<PeriodLog, 'start_date' | 'end_date' | 'flow_level' | 'pain_level' | 'notes'>

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

  // Re-read all records, not just the twelve displayed in the history.
  const syncLatestPeriod = async (previousStart: string) => {
    if (!user) return
    try {
      const { data: latest, error: latestError } = await supabase.from('period_logs')
        .select('start_date').eq('user_id', user.id)
        .order('start_date', { ascending: false }).limit(1).maybeSingle()
      if (latestError) throw latestError
      const latestDate = latest?.start_date ?? null
      // Preserve a newer profile date written by another session or onboarding.
      const conditions = ['last_period_date.is.null', `last_period_date.eq.${previousStart}`]
      if (latestDate) conditions.push(`last_period_date.lt.${latestDate}`)
      const { data: profile, error: profileError } = await supabase.from('users')
        .update({ last_period_date: latestDate }).eq('id', user.id)
        .or(conditions.join(',')).select().maybeSingle()
      if (profileError) throw profileError
      if (profile) setProfile(profile)
    } catch {
      // The record mutation has already succeeded. Do not invite a duplicate retry.
      setError('period.syncFailed')
    }
  }

  const updatePeriod = async (id: string, payload: Partial<PeriodPayload>) => {
    if (!user) return
    setError(null)
    const { data: previous, error: readError } = await supabase.from('period_logs')
      .select('*').eq('id', id).eq('user_id', user.id).single()
    if (readError) throw readError
    const next = { ...previous, ...payload }
    if (!next.start_date || (next.end_date && next.end_date < next.start_date)) {
      throw new Error('Invalid period dates')
    }
    const { data, error } = await supabase.from('period_logs').update(payload)
      .eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setLogs((prev) => prev.map((l) => l.id === id ? data : l)
      .sort((a, b) => b.start_date.localeCompare(a.start_date)))
    if (previous.start_date !== data.start_date) await syncLatestPeriod(previous.start_date)
    return data
  }

  const deletePeriod = async (id: string) => {
    if (!user) return
    setError(null)
    // Returning the deleted row also detects a missing or unauthorised record.
    const { data, error } = await supabase.from('period_logs').delete()
      .eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setLogs((prev) => prev.filter((log) => log.id !== id))
    await syncLatestPeriod(data.start_date)
  }

  return { logs, loading, error, addPeriod, updatePeriod, deletePeriod, refetch: fetch }
}
