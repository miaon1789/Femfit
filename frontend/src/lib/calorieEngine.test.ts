import { describe, it, expect } from 'vitest'
import type { ExerciseLog, StepTier, WorkoutType } from '@/types'
import {
  computeBMR,
  computeTDEE,
  computeDeficit,
  computeMinimumTarget,
  computeBaseTarget,
  getLegacyStepAdjustment,
  getStepAdjustmentFromDelta,
  getWorkoutAdjustment,
  getCycleAdjustment,
  detectActivityLevel,
  estimateMaintenanceTDEE,
  computeDailyCalorieTarget,
  type DailyPoint,
} from './calorieEngine'

/** Minimal ExerciseLog factory — only the fields the engine reads matter. */
function log(partial: Partial<ExerciseLog>): ExerciseLog {
  return {
    id: 'x',
    user_id: 'u',
    date: '2026-01-01',
    steps: null,
    step_tier: null,
    workout_type: null,
    duration_minutes: null,
    heart_rate_avg: null,
    watch_calories: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

describe('computeBMR (Mifflin-St Jeor, female)', () => {
  it('matches the formula 10W + 6.25H - 5A - 161, rounded', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(computeBMR(60, 165, 30)).toBe(1320)
  })
})

describe('computeTDEE', () => {
  it('scales BMR by the activity factor', () => {
    expect(computeTDEE(1320, 'sedentary')).toBe(Math.round(1320 * 1.2))
    expect(computeTDEE(1320, 'moderate')).toBe(Math.round(1320 * 1.55))
    expect(computeTDEE(1320, 'heavy')).toBe(Math.round(1320 * 1.725))
  })
})

describe('computeDeficit (clamped per pace)', () => {
  it('slow stays within 200–350', () => {
    expect(computeDeficit(2000, 'slow')).toBe(300) // 0.15*2000
    expect(computeDeficit(1000, 'slow')).toBe(200) // 150 -> floor 200
    expect(computeDeficit(3000, 'slow')).toBe(350) // 450 -> cap 350
  })
  it('moderate stays within 400–600', () => {
    expect(computeDeficit(2000, 'moderate')).toBe(500) // 0.25*2000
    expect(computeDeficit(1000, 'moderate')).toBe(400) // floor
    expect(computeDeficit(3000, 'moderate')).toBe(600) // cap
  })
  it('fast stays within 500–750', () => {
    expect(computeDeficit(2000, 'fast')).toBe(640) // 0.32*2000
    expect(computeDeficit(1000, 'fast')).toBe(500) // floor
    expect(computeDeficit(3000, 'fast')).toBe(750) // cap
  })
})

describe('computeMinimumTarget', () => {
  it('never drops below 1200', () => {
    expect(computeMinimumTarget(1300)).toBe(1200) // 0.9*1300=1170 -> 1200
  })
  it('uses 90% of BMR when that is higher', () => {
    expect(computeMinimumTarget(1500)).toBe(1350) // 0.9*1500
  })
})

describe('computeBaseTarget', () => {
  it('subtracts the deficit but respects the safety floor', () => {
    expect(computeBaseTarget(2000, 'moderate', 1200)).toBe(1500) // 2000-500
    expect(computeBaseTarget(1400, 'fast', 1200)).toBe(1200) // 1400-560=840 -> floor 1200
  })
})

describe('step adjustments', () => {
  it('legacy tier map (null -> 0)', () => {
    const cases: Array<[StepTier | null, number]> = [
      ['low', -50], ['normal', 0], ['high', 50], ['very_high', 100], [null, 0],
    ]
    for (const [tier, expected] of cases) expect(getLegacyStepAdjustment(tier)).toBe(expected)
  })

  it('delta vs recent average drives the tiered nudge', () => {
    const recent = [log({ steps: 5000 })]
    expect(getStepAdjustmentFromDelta(null, recent)).toBe(0) // no today steps
    expect(getStepAdjustmentFromDelta(5000, [])).toBe(0) // no baseline
    expect(getStepAdjustmentFromDelta(5000, recent)).toBe(0) // delta 0
    expect(getStepAdjustmentFromDelta(8000, recent)).toBe(50) // +3000
    expect(getStepAdjustmentFromDelta(12000, recent)).toBe(100) // +7000
    expect(getStepAdjustmentFromDelta(1000, recent)).toBe(-50) // -4000
  })
})

describe('getWorkoutAdjustment', () => {
  it('returns 0 without a valid type/duration', () => {
    expect(getWorkoutAdjustment(null, 60)).toBe(0)
    expect(getWorkoutAdjustment('cardio', 0)).toBe(0)
    expect(getWorkoutAdjustment('cardio', null)).toBe(0)
  })
  it('tops up conservatively by type and duration', () => {
    const cases: Array<[WorkoutType, number, number]> = [
      ['strength', 30, 50], ['strength', 60, 80],
      ['hiit', 20, 70], ['hiit', 40, 100],
      ['cardio', 20, 40], ['cardio', 45, 70], ['cardio', 90, 100],
      ['yoga', 30, 0], ['yoga', 60, 20],
      ['other', 30, 30],
    ]
    for (const [type, dur, expected] of cases) {
      expect(getWorkoutAdjustment(type, dur)).toBe(expected)
    }
  })
})

describe('getCycleAdjustment', () => {
  it('relaxes the target during menstrual & luteal, neutral otherwise', () => {
    expect(getCycleAdjustment('menstrual')).toBe(75)
    expect(getCycleAdjustment('follicular')).toBe(0)
    expect(getCycleAdjustment('ovulation')).toBe(0)
    expect(getCycleAdjustment('luteal')).toBe(75)
  })
})

describe('detectActivityLevel', () => {
  const steps = (n: number, count = 10) => Array.from({ length: count }, () => log({ steps: n }))

  it('returns null without enough data', () => {
    expect(detectActivityLevel(steps(8000, 6))).toBeNull() // < 7 logs
    expect(detectActivityLevel([])).toBeNull()
  })
  it('tiers by average steps', () => {
    expect(detectActivityLevel(steps(11000))).toBe('heavy')
    expect(detectActivityLevel(steps(8000))).toBe('moderate')
    expect(detectActivityLevel(steps(6000))).toBe('light')
    expect(detectActivityLevel(steps(3000))).toBe('sedentary')
  })
  it('also tiers up on workout frequency', () => {
    const allWorkouts = Array.from({ length: 7 }, () => log({ steps: 3000, workout_type: 'strength' }))
    expect(detectActivityLevel(allWorkouts)).toBe('heavy') // 7 workouts/wk despite low steps
  })
})

describe('estimateMaintenanceTDEE (energy balance)', () => {
  function series(slopeKgPerDay: number, intake: number, days = 21): DailyPoint[] {
    return Array.from({ length: days }, (_, day) => ({
      day,
      weightKg: 70 + slopeKgPerDay * day,
      intakeKcal: intake,
    }))
  }

  it('returns mean intake when weight is stable', () => {
    expect(estimateMaintenanceTDEE(series(0, 2200))).toBe(2200)
  })

  it('adds back the deficit implied by a falling weight trend', () => {
    // losing 0.05 kg/day on 2000 kcal => TDEE = 2000 - (-0.05)*7700 = 2385
    expect(estimateMaintenanceTDEE(series(-0.05, 2000))).toBe(2385)
  })

  it('returns null below the minimum window', () => {
    expect(estimateMaintenanceTDEE(series(0, 2000, 20))).toBeNull()
  })
})

describe('computeDailyCalorieTarget (integration)', () => {
  const base = {
    weightKg: 60,
    heightCm: 165,
    ageYears: 30,
    activityLevel: 'moderate' as const,
    weightGoalPace: 'moderate' as const,
    cyclePhase: 'follicular' as const,
    todaySteps: null,
    stepTier: null,
    workoutType: null,
    durationMinutes: null,
    recentExerciseLogs: [] as ExerciseLog[],
    dataTDEE: null,
  }

  it('falls back to the formula TDEE when no data TDEE is supplied', () => {
    const r = computeDailyCalorieTarget(base)
    expect(r.tdeeSource).toBe('formula')
    expect(r.usedActivityLevel).toBe('moderate') // detect() returns null on empty logs
    expect(r.stepAdjustment).toBe(0)
    expect(r.workoutAdjustment).toBe(0)
    expect(r.cycleAdjustment).toBe(0) // follicular
  })

  it('prefers the data-driven TDEE when provided', () => {
    const r = computeDailyCalorieTarget({ ...base, dataTDEE: 2100 })
    expect(r.tdeeSource).toBe('data')
    expect(r.tdee).toBe(2100)
  })

  it('applies the cycle relaxation in the luteal phase', () => {
    const follicular = computeDailyCalorieTarget(base)
    const luteal = computeDailyCalorieTarget({ ...base, cyclePhase: 'luteal' })
    expect(luteal.cycleAdjustment).toBe(75)
    expect(luteal.finalTarget).toBe(follicular.finalTarget + 75)
  })

  it('never returns a target below the individualized minimum', () => {
    const r = computeDailyCalorieTarget({ ...base, weightGoalPace: 'fast', dataTDEE: 1300 })
    expect(r.finalTarget).toBeGreaterThanOrEqual(r.minimumTarget)
  })
})
