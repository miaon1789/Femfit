/**
 * cycleEngine.ts
 *
 * Calculate menstrual cycle phases and predicted dates.
 * Calorie targets are calculated in calorieEngine.ts.
 */

import dayjs from 'dayjs'
import type { CyclePhase, CycleInfo } from '@/types'

// Historical phases for charts

/** Calculate the cycle phase for a historical date. */
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

/** Group consecutive dates in the same phase for chart background bands. */
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

// Current cycle information
//
// Phase labels and short tips live in i18n (cycle.phase.* / cycle.tip.*).
// Components translate them with t(). The engine returns phase IDs and ISO dates.

/**
 * Use the last period start, average cycle length and average period length
 * to calculate the current phase and predicted dates.
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
