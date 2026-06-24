import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { estimateMaintenanceTDEE, type DailyPoint } from '@/lib/calorieEngine'

/**
 * 拉取最近 60 天的体重与每日摄入，用能量平衡反推用户真实维持热量。
 * 数据不足时 tdee 为 null（调用方回退到公式 TDEE）。
 */
export function useMaintenanceTDEE(): { tdee: number | null; nDays: number } {
  const { user } = useAuthStore()
  const [state, setState] = useState<{ tdee: number | null; nDays: number }>({ tdee: null, nDays: 0 })

  useEffect(() => {
    if (!user) return
    let cancelled = false

    ;(async () => {
      const from = dayjs().subtract(60, 'day').format('YYYY-MM-DD')
      const [{ data: weights }, { data: meals }] = await Promise.all([
        supabase.from('weight_logs').select('date, weight_kg').eq('user_id', user.id).gte('date', from),
        supabase.from('meal_logs').select('date, food_entries(calories)').eq('user_id', user.id).gte('date', from),
      ])

      const weightByDate = new Map<string, number>()
      for (const w of weights ?? []) weightByDate.set(w.date, Number(w.weight_kg))

      const intakeByDate = new Map<string, number>()
      for (const m of (meals ?? []) as { date: string; food_entries: { calories: number }[] }[]) {
        const sum = (m.food_entries ?? []).reduce((s, f) => s + Number(f.calories), 0)
        intakeByDate.set(m.date, (intakeByDate.get(m.date) ?? 0) + sum)
      }

      // 只取「同时有体重和摄入」的日期
      const dates = [...weightByDate.keys()].filter((d) => intakeByDate.has(d)).sort()
      const base = dates.length ? dayjs(dates[0]) : null
      const points: DailyPoint[] = dates.map((d) => ({
        day: dayjs(d).diff(base!, 'day'),
        weightKg: weightByDate.get(d)!,
        intakeKcal: intakeByDate.get(d)!,
      }))

      const tdee = estimateMaintenanceTDEE(points)
      if (!cancelled) setState({ tdee, nDays: points.length })
    })()

    return () => { cancelled = true }
  }, [user])

  return state
}
