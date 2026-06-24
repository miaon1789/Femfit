import { supabase } from '@/lib/supabase'
import { getPhaseForDate } from '@/lib/cycleEngine'
import type { UserProfile } from '@/types'

/**
 * 把当前用户的全部记录聚合成「每日一行」的表并下载为 CSV。
 *
 * 列：date, weight_kg, intake_kcal, steps, phase
 * —— 正是 analysis/ 数据科学管线 load_data() 读取的格式，
 * 让用户能把自己的真实数据喂进 TDEE 估计与周期分析。
 */
export async function exportUserDataCsv(userId: string, profile: UserProfile): Promise<number> {
  const [{ data: weights }, { data: exercises }, { data: meals }] = await Promise.all([
    supabase.from('weight_logs').select('date, weight_kg').eq('user_id', userId),
    supabase.from('exercise_logs').select('date, steps').eq('user_id', userId),
    supabase.from('meal_logs').select('date, food_entries(calories)').eq('user_id', userId),
  ])

  interface DayRow { weight_kg?: number; intake_kcal?: number; steps?: number }
  const byDate = new Map<string, DayRow>()
  const row = (d: string): DayRow => {
    let r = byDate.get(d)
    if (!r) { r = {}; byDate.set(d, r) }
    return r
  }

  for (const w of weights ?? []) row(w.date).weight_kg = Number(w.weight_kg)
  for (const e of exercises ?? []) if (e.steps != null) row(e.date).steps = Number(e.steps)
  for (const m of (meals ?? []) as { date: string; food_entries: { calories: number }[] }[]) {
    const sum = (m.food_entries ?? []).reduce((s, f) => s + Number(f.calories), 0)
    const r = row(m.date)
    r.intake_kcal = (r.intake_kcal ?? 0) + sum
  }

  const dates = [...byDate.keys()].sort()
  if (!dates.length) return 0

  const header = 'date,weight_kg,intake_kcal,steps,phase'
  const lines = dates.map((d) => {
    const r = byDate.get(d)!
    const phase = profile.last_period_date
      ? getPhaseForDate(d, profile.last_period_date, profile.avg_cycle_days, profile.avg_period_days)
      : ''
    return [
      d,
      r.weight_kg != null ? r.weight_kg.toFixed(1) : '',
      r.intake_kcal != null ? Math.round(r.intake_kcal) : '',
      r.steps != null ? r.steps : '',
      phase,
    ].join(',')
  })
  const csv = [header, ...lines].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `femfit-data-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return dates.length
}
