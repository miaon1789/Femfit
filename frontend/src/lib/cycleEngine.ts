/**
 * cycleEngine.ts
 *
 * 专注于月经周期阶段的判断与预测。
 * 热量目标计算已迁移至 calorieEngine.ts。
 */

import dayjs from 'dayjs'
import type { CyclePhase, CycleInfo } from '@/types'

// ── 历史日期阶段计算（图表用） ─────────────────────────────────────────────────

/** 计算某个历史日期处于哪个周期阶段 */
export function getPhaseForDate(
  date: string,
  lastPeriodDate: string,
  avgCycleDays: number,
  avgPeriodDays: number
): CyclePhase {
  const daysSince = dayjs(date).diff(dayjs(lastPeriodDate), 'day')
  const dayOfCycle = ((daysSince % avgCycleDays) + avgCycleDays) % avgCycleDays + 1
  if (dayOfCycle <= avgPeriodDays) return 'menstrual'
  if (dayOfCycle <= avgCycleDays - 14 - 2) return 'follicular'
  if (dayOfCycle <= avgCycleDays - 14 + 2) return 'ovulation'
  return 'luteal'
}

/** 在给定日期列表中，生成连续同阶段的分段（用于图表背景色） */
export function generatePhaseSegments(
  dates: string[],
  lastPeriodDate: string,
  avgCycleDays: number,
  avgPeriodDays: number
): Array<{ start: string; end: string; phase: CyclePhase }> {
  if (!dates.length) return []
  const segments: Array<{ start: string; end: string; phase: CyclePhase }> = []
  let currentPhase = getPhaseForDate(dates[0], lastPeriodDate, avgCycleDays, avgPeriodDays)
  let segStart = dates[0]
  for (let i = 1; i < dates.length; i++) {
    const phase = getPhaseForDate(dates[i], lastPeriodDate, avgCycleDays, avgPeriodDays)
    if (phase !== currentPhase) {
      segments.push({ start: segStart, end: dates[i - 1], phase: currentPhase })
      currentPhase = phase
      segStart = dates[i]
    }
  }
  segments.push({ start: segStart, end: dates[dates.length - 1], phase: currentPhase })
  return segments
}

// ── 当前周期阶段信息 ──────────────────────────────────────────────────────────
//
// 注意：阶段标签与一句话建议已移到 i18n（cycle.phase.* / cycle.tip.*），
// 由组件按当前语言用 t() 渲染；引擎只返回稳定的 phase id 与 ISO 日期。

/**
 * 根据最后一次月经开始日期、平均周期天数、平均经期天数，
 * 计算当前所处的月经周期阶段及预测日期。
 */
export function computeCycleInfo(
  lastPeriodDate: string,
  avgCycleDays: number,
  avgPeriodDays: number
): CycleInfo {
  const today = dayjs()
  const lastPeriod = dayjs(lastPeriodDate)

  const daysSincePeriod = today.diff(lastPeriod, 'day')
  const dayOfCycle = ((daysSincePeriod % avgCycleDays) + avgCycleDays) % avgCycleDays + 1

  const cyclesCompleted = Math.floor(daysSincePeriod / avgCycleDays)
  const nextPeriodStart = lastPeriod.add((cyclesCompleted + 1) * avgCycleDays, 'day')
  const ovulationDay = nextPeriodStart.subtract(14, 'day')

  let phase: CyclePhase
  if (dayOfCycle <= avgPeriodDays) {
    phase = 'menstrual'
  } else if (dayOfCycle <= avgCycleDays - 14 - 2) {
    phase = 'follicular'
  } else if (dayOfCycle <= avgCycleDays - 14 + 2) {
    phase = 'ovulation'
  } else {
    phase = 'luteal'
  }

  return {
    phase,
    dayOfCycle,
    predictedNextPeriod: nextPeriodStart.format('YYYY-MM-DD'),
    predictedOvulation: ovulationDay.format('YYYY-MM-DD'),
  }
}
