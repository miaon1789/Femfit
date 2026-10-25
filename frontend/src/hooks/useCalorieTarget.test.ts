import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCalorieTarget } from './useCalorieTarget'
import { computeDailyCalorieTarget } from '@/lib/calorieEngine'

const state = vi.hoisted(() => ({
  profile: { weight_kg: 60, height_cm: 165, birth_year: 1996, birth_month: 1,
    activity_level: 'moderate', weight_goal_pace: 'moderate',
    last_period_date: '2026-01-01', avg_cycle_days: 28, avg_period_days: 5 },
  exerciseLogs: [] as Array<Record<string, unknown>>,
  latestWeightLog: null as { date: string; weight_kg: number } | null,
}))
vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }))
vi.mock('@/store/userStore', () => ({ useUserStore: () => ({ profile: state.profile }) }))
vi.mock('./useLatestWeightLog', () => ({ useLatestWeightLog: () => ({ log: state.latestWeightLog }) }))
vi.mock('./useExerciseLogs', () => ({ useExerciseLogs: () => ({ logs: state.exerciseLogs }) }))
vi.mock('./useMaintenanceTDEE', () => ({ useMaintenanceTDEE: () => ({ tdee: null }) }))

afterEach(() => { vi.useRealTimers(); state.exerciseLogs = []; state.latestWeightLog = null })
describe('calorie target wiring', () => {
  it('uses the latest logged weight even when it is older than seven days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 26, 9))
    const fallback = useCalorieTarget()!
    state.latestWeightLog = { date: '2026-08-06', weight_kg: 54.6 }
    const target = useCalorieTarget()!
    const expected = computeDailyCalorieTarget({
      weightKg: 54.6, heightCm: 165, ageYears: 30, activityLevel: 'moderate',
      weightGoalPace: 'moderate', cyclePhase: 'luteal', todaySteps: null,
      stepTier: null, workoutType: null, durationMinutes: null,
      recentExerciseLogs: [], dataTDEE: null,
    })
    expect(target.bmr).toBe(expected.bmr)
    expect(target.bmr).not.toBe(fallback.bmr)
  })
  it('recalculates cycle calories when a new period starts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 6, 9))
    state.profile.last_period_date = '2026-01-01'
    const before = useCalorieTarget()!
    state.profile.last_period_date = '2026-01-06'
    const after = useCalorieTarget()!
    expect(before.cycleAdjustment).toBe(0)
    expect(after.cycleAdjustment).toBe(75)
    expect(after.finalTarget - before.finalTarget).toBe(75)
    state.profile.last_period_date = '2026-01-01'
  })
  it('uses real steps against prior days, excluding today and future logs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 6, 9))
    state.exerciseLogs = [
      { date: '2026-01-07', steps: 50000 },
      { date: '2026-01-06', steps: 7000, step_tier: 'normal' },
      { date: '2026-01-05', steps: 5000 },
    ]
    const target = useCalorieTarget()!
    expect(target.avgRecentSteps).toBe(5000)
    expect(target.stepAdjustment).toBe(50)
  })
})
