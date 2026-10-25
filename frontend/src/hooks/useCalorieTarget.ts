import { useMemo } from 'react'
import { useUserStore } from '@/store/userStore'
import { useLatestWeightLog } from './useLatestWeightLog'
import { useExerciseLogs } from './useExerciseLogs'
import { useMaintenanceTDEE } from './useMaintenanceTDEE'
import { computeCycleInfo } from '@/lib/cycleEngine'
import { computeDailyCalorieTarget } from '@/lib/calorieEngine'
import type { CalorieBreakdown } from '@/lib/calorieEngine'
import dayjs from 'dayjs'

/**
 * 综合周期阶段、今日运动数据、近期历史，计算当日智能热量目标。
 * 返回 null 表示 profile 尚未加载。
 */
export function useCalorieTarget(): CalorieBreakdown | null {
  const { profile } = useUserStore()
  const today = dayjs().format('YYYY-MM-DD')

  // Use the latest recorded weight, even when no weight was logged this week.
  const { log: latestWeightLog } = useLatestWeightLog()
  const { logs: exerciseLogs } = useExerciseLogs(14)  // 14 天用于自动活动检测
  const { tdee: dataTDEE } = useMaintenanceTDEE()      // 数据驱动的维持热量（数据足够时）

  return useMemo(() => {
    if (!profile) return null

    // 今日体重（最新记录优先）
    const todayWeight = latestWeightLog?.weight_kg ?? profile.weight_kg

    // 今日运动记录
    const todayExercise = exerciseLogs.find((l) => l.date === today) ?? null

    // 当前周期阶段
    const { phase } = computeCycleInfo(
      profile.last_period_date,
      profile.avg_cycle_days,
      profile.avg_period_days
    )

    // 年龄
    const currentMonth = dayjs().month() + 1
    const ageYears = dayjs().year() - profile.birth_year
      - (currentMonth < profile.birth_month ? 1 : 0)

    return computeDailyCalorieTarget({
      weightKg: todayWeight,
      heightCm: profile.height_cm,
      ageYears,
      activityLevel: profile.activity_level,
      weightGoalPace: profile.weight_goal_pace,
      cyclePhase: phase,
      todaySteps: todayExercise?.steps ?? null,
      stepTier: todayExercise?.step_tier ?? null,
      workoutType: todayExercise?.workout_type ?? null,
      durationMinutes: todayExercise?.duration_minutes ?? null,
      recentExerciseLogs: exerciseLogs.filter((log) => log.date < today),
      dataTDEE,
    })
  }, [profile, latestWeightLog, exerciseLogs, dataTDEE, today])
}
