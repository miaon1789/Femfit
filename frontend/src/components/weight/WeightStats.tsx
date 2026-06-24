import { useTranslation } from 'react-i18next'
import type { WeightLog } from '@/types'

interface WeightStatsProps {
  logs: WeightLog[]
  targetWeight: number
  heightCm: number
}

export function WeightStats({ logs, targetWeight, heightCm }: WeightStatsProps) {
  const { t } = useTranslation()
  if (!logs.length) return null

  const latest = logs[logs.length - 1]
  const latestWeight = latest.weight_kg

  // 7 日滑动平均（取最近 7 条）
  const recent7 = logs.slice(-7)
  const avg7 = recent7.reduce((s, l) => s + l.weight_kg, 0) / recent7.length

  // 周变化率（最近一条 vs 7 天前最近一条）
  let weeklyChange: number | null = null
  if (logs.length >= 2) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const oldLog = [...logs].reverse().find((l) => l.date <= sevenDaysAgo)
    if (oldLog) weeklyChange = latestWeight - oldLog.weight_kg
  }

  // 距目标
  const toGoal = latestWeight - targetWeight

  // BMI
  const bmi = latestWeight / Math.pow(heightCm / 100, 2)
  const bmiLabel = bmi < 18.5 ? t('dashboard.bmiUnder')
    : bmi < 24 ? t('dashboard.bmiNormal')
    : bmi < 28 ? t('dashboard.bmiOver')
    : t('dashboard.bmiObese')

  const stats = [
    {
      label: t('weight.latest'),
      value: `${latestWeight.toFixed(1)} kg`,
      sub: latest.date,
    },
    {
      label: t('weight.avg7'),
      value: `${avg7.toFixed(1)} kg`,
      sub: t('weight.recentN', { n: recent7.length }),
    },
    {
      label: t('weight.weeklyChange'),
      value: weeklyChange !== null
        ? `${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(1)} kg`
        : '—',
      sub: t('weight.vs7days'),
      valueColor: weeklyChange !== null
        ? weeklyChange < 0 ? 'text-green-600' : weeklyChange > 0 ? 'text-red-500' : 'text-gray-600'
        : 'text-gray-400',
    },
    {
      label: t('weight.toGoal'),
      value: toGoal > 0 ? `-${toGoal.toFixed(1)} kg` : t('weight.reached'),
      sub: t('weight.targetX', { w: targetWeight }),
      valueColor: toGoal <= 0 ? 'text-green-600' : 'text-primary-600',
    },
    {
      label: 'BMI',
      value: bmi.toFixed(1),
      sub: bmiLabel,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(({ label, value, sub, valueColor }) => (
        <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className={`text-xl font-bold ${valueColor ?? 'text-gray-900'}`}>{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  )
}
