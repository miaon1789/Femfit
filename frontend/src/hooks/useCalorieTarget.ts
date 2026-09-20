import { useMemo } from 'react'
import { useUserStore } from '@/store/userStore'
import { useWeightLogs } from './useWeightLogs'
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

  // 只取今日体重用于计算（若有），否则用 profile 初始体重
  const { logs: weightLogs } = useWeightLogs(7)
  const { logs: exerciseLogs } = useExerciseLogs(14)  // 14 天用于自动活动检测
  const { tdee: dataTDEE } = useMaintenanceTDEE()      // 数据驱动的维持热量（数据足够时）

  return useMemo(() => {
    if (!profile) return null

    // 今日体重（最新记录优先）
    const todayWeight = weightLogs.find((l) => l.date === today)?.weight_kg
      ?? weightLogs.at(-1)?.weight_kg
      ?? profile.weight_kg

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
  }, [profile, weightLogs, exerciseLogs, dataTDEE, today])
}
