import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import dayjs from 'dayjs'
import type { WeightLog } from '@/types'
import type { UserProfile } from '@/types'
import { generatePhaseSegments } from '@/lib/cycleEngine'

type Range = 7 | 30 | 90

const PHASE_COLORS: Record<string, string> = {
  menstrual:  '#fecaca', // red-200
  follicular: '#bbf7d0', // green-200
  ovulation:  '#fef08a', // yellow-200
  luteal:     '#ddd6fe', // purple-200
}

const PHASES = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const

interface ChartPoint {
  date: string
  display: string   // MM/DD
  weight: number | null
  avg7: number | null
}

interface WeightChartProps {
  logs: WeightLog[]
  profile: UserProfile
}

function computeMovingAverage(points: ChartPoint[], window = 7): ChartPoint[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1).filter((x) => x.weight !== null)
    const avg = slice.length > 0 ? slice.reduce((s, x) => s + x.weight!, 0) / slice.length : null
    return { ...p, avg7: avg ? parseFloat(avg.toFixed(2)) : null }
  })
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name: string; value: number; color: string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3 text-sm">
      <p className="text-gray-500 mb-1">{label}</p>
      {payload.map((p) => p.value && (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value.toFixed(1)} kg
        </p>
      ))}
    </div>
  )
}

export function WeightChart({ logs, profile }: WeightChartProps) {
  const { t } = useTranslation()
  const [range, setRange] = useState<Range>(30)

  const { points, segments, yDomain } = useMemo(() => {
    const fromDate = dayjs().subtract(range - 1, 'day')
    const allDates: string[] = []
    for (let i = 0; i < range; i++) {
      allDates.push(fromDate.add(i, 'day').format('YYYY-MM-DD'))
    }

    // 构建 log 查找 map
    const logMap = new Map(logs.map((l) => [l.date, l.weight_kg]))

    // 填入所有日期
    const raw: ChartPoint[] = allDates.map((d) => ({
      date: d,
      display: dayjs(d).format('MM/DD'),
      weight: logMap.get(d) ?? null,
      avg7: null,
    }))

    const withAvg = computeMovingAverage(raw)

    // 计算 Y 轴范围（有数据的点）
    const weights = logs.filter((l) => l.date >= allDates[0]).map((l) => l.weight_kg)
    const allValues = [...weights, profile.target_weight_kg]
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = Math.max((max - min) * 0.15, 2)
    const yDomain: [number, number] = [
      parseFloat((min - padding).toFixed(1)),
      parseFloat((max + padding).toFixed(1)),
    ]

    // 周期阶段分段
    const segs = generatePhaseSegments(
      allDates,
      profile.last_period_date,
      profile.avg_cycle_days,
      profile.avg_period_days
    )

    return { points: withAvg, segments: segs, yDomain }
  }, [logs, range, profile])

  const hasData = logs.length > 0

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      {/* 时间范围选择 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{t('chart.title')}</h3>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${
                range === r ? 'bg-white text-primary-600 shadow-sm font-medium' : 'text-gray-500'
              }`}
            >
              {t('chart.rangeDays', { n: r })}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="h-48 flex flex-col items-center justify-center text-gray-400">
          <p className="text-3xl mb-2">⚖️</p>
          <p className="text-sm">{t('chart.emptyTitle')}</p>
          <p className="text-xs mt-1">{t('chart.emptyHint')}</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

              {/* 周期阶段背景色 */}
              {segments.map((seg) => (
                <ReferenceArea
                  key={`${seg.start}-${seg.phase}`}
                  x1={dayjs(seg.start).format('MM/DD')}
                  x2={dayjs(seg.end).format('MM/DD')}
                  fill={PHASE_COLORS[seg.phase]}
                  fillOpacity={0.4}
                  strokeOpacity={0}
                />
              ))}

              <XAxis
                dataKey="display"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval={range === 7 ? 0 : range === 30 ? 4 : 13}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* 实际体重 */}
              <Line
                type="monotone"
                dataKey="weight"
                name={t('chart.weight')}
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ r: 3, fill: '#ec4899', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              {/* 7日均值 */}
              <Line
                type="monotone"
                dataKey="avg7"
                name={t('chart.avg7')}
                stroke="#a855f7"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 周期阶段图例 */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {PHASES.map((phase) => (
              <div key={phase} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: PHASE_COLORS[phase], opacity: 0.7 }}
                />
                <span className="text-xs text-gray-500">{t(`cycle.phase.${phase}`)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-5 h-0.5 bg-pink-500 rounded" />
              <span className="text-xs text-gray-500">{t('chart.weight')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-0.5 bg-purple-500 rounded" style={{ borderTop: '1.5px dashed #a855f7' }} />
              <span className="text-xs text-gray-500">{t('chart.avg7')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
