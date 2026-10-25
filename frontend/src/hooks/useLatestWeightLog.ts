import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { WeightLog } from '@/types'

/** Latest recorded weight up to today, independent of chart history windows. */
export function useLatestWeightLog() {
  const userId = useAuthStore().user?.id
  const today = dayjs().format('YYYY-MM-DD')
  const [result, setResult] = useState<{
    userId: string | undefined
    log: WeightLog | null
    loading: boolean
    error: string | null
  }>({ userId: undefined, log: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setResult({ userId, log: null, loading: false, error: null })
      return
    }
    setResult({ userId, log: null, loading: true, error: null })
    async function fetchLatest() {
      try {
        const { data, error } = await supabase.from('weight_logs')
          .select('*').eq('user_id', userId).lte('date', today)
          .order('date', { ascending: false }).limit(1).maybeSingle()
        if (!cancelled) setResult({
          userId, log: error ? null : data, loading: false, error: error?.message ?? null,
        })
      } catch (error) {
        if (!cancelled) setResult({
          userId, log: null, loading: false,
          error: error instanceof Error ? error.message : 'Unable to load weight',
        })
      }
    }
    void fetchLatest()
    return () => { cancelled = true }
  }, [userId, today])

  if (result.userId !== userId) return { log: null, loading: !!userId, error: null }
  return { log: result.log, loading: result.loading, error: result.error }
}
