/**
 * calorieEngine.ts
 *
 * 改进版四层热量目标模型：
 *   Layer 1  平均减脂热量  = 平均 TDEE - 减脂缺口
 *   Layer 2  步数调节      = 基于“今日步数 vs 最近平均步数”的偏差微调
 *   Layer 3  训练调节      = 训练日小幅补充（不吃回全部训练消耗）
 *   Layer 4  周期调节      = 月经阶段温和修正
 *
 * 最终目标 = Layer1 + Layer2 + Layer3 + Layer4，且 ≥ 个体化最低热量
 */

import type {
  ActivityLevel,
  WeightGoalPace,
  CyclePhase,
  StepTier,
  WorkoutType,
} from '@/types'
import type { ExerciseLog } from '@/types'

// ── Layer 1：基础减脂热量 ─────────────────────────────────────────────────────

/**
 * Mifflin-St Jeor（女性）
 * BMR = 10W + 6.25H - 5A - 161
 */
export function computeBMR(weightKg: number, heightCm: number, ageYears: number): number {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161)
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  heavy: 1.725,
}

export function computeTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel])
}

/**
 * 减脂缺口
 * slow ≈ 200–350 kcal；moderate ≈ 400–600 kcal；fast ≈ 500–750 kcal
 */
const DEFICIT_RATIOS: Record<WeightGoalPace, number> = {
  slow: 0.15,
  moderate: 0.25,
  fast: 0.32,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function computeDeficit(tdee: number, pace: WeightGoalPace): number {
  const raw = tdee * DEFICIT_RATIOS[pace]
  switch (pace) {
    case 'slow':
      return Math.round(clamp(raw, 200, 350))
    case 'moderate':
      return Math.round(clamp(raw, 400, 600))
    case 'fast':
      return Math.round(clamp(raw, 500, 750))
    default:
      return 400
  }
}

/**
 * 个体化最低热量保护：
 *  1) 1200
 *  2) BMR 的 90%（不低于基础代谢的 90%）
 */
export function computeMinimumTarget(bmr: number): number {
  return Math.round(Math.max(1200, bmr * 0.9))
}

export function computeBaseTarget(tdee: number, pace: WeightGoalPace, minimumTarget: number): number {
  const deficit = computeDeficit(tdee, pace)
  return Math.max(minimumTarget, tdee - deficit)
}

// ── Layer 2：步数调节（NEAT） ──────────────────────────────────────────────────

/**
 * 兼容旧参数 StepTier 的兜底版本（若没有 todaySteps / recent logs）
 * 注意：这里只做非常小的微调，避免与 Layer 1 双算。
 */
const LEGACY_STEP_ADJUSTMENTS: Record<StepTier, number> = {
  low: -50,
  normal: 0,
  high: 50,
  very_high: 100,
}

export function getLegacyStepAdjustment(stepTier: StepTier | null): number {
  if (!stepTier) return 0
  return LEGACY_STEP_ADJUSTMENTS[stepTier]
}

function averageRecentSteps(logs: ExerciseLog[], days = 14): number | null {
  const recent = logs.slice(0, days)
  if (!recent.length) return null

  const stepLogs = recent.filter((l) => l.steps !== null)
  if (!stepLogs.length) return null

  const avg = stepLogs.reduce((sum, l) => sum + (l.steps ?? 0), 0) / stepLogs.length
  return Math.round(avg)
}

/**
 * 推荐版本：根据“今天步数”相对“最近平均步数”的偏差来修正。
 * 这样不会把“本来就高活动”的用户再重复加热量。
 */
export function getStepAdjustmentFromDelta(todaySteps: number | null, recentExerciseLogs: ExerciseLog[]): number {
  if (todaySteps === null) return 0

  const avgSteps = averageRecentSteps(recentExerciseLogs, 14)
  if (avgSteps === null) return 0

  const delta = todaySteps - avgSteps

  if (delta <= -3000) return -50
  if (delta < 2000) return 0
  if (delta < 6000) return 50
  return 100
}

// ── Layer 3：训练调节 ─────────────────────────────────────────────────────────

/**
 * 只回补小部分消耗，避免“练了就多吃很多”。
 * 不直接使用手表热量，因为误差通常较大。
 */
export function getWorkoutAdjustment(
  workoutType: WorkoutType | null,
  durationMinutes: number | null
): number {
  if (!workoutType || !durationMinutes || durationMinutes <= 0) return 0

  const dur = durationMinutes

  switch (workoutType) {
    case 'strength':
      // 力量训练：普通日小幅支持恢复
      return dur < 45 ? 50 : 80

    case 'hiit':
      // HIIT：略高于力量，但仍保守
      return dur < 30 ? 70 : 100

    case 'cardio':
      // 有氧：时长分层
      if (dur < 30) return 40
      if (dur < 60) return 70
      return 100

    case 'yoga':
      return dur < 45 ? 0 : 20

    case 'other':
      return 30

    default:
      return 0
  }
}

// ── Layer 4：周期调节 ─────────────────────────────────────────────────────────

/**
 * 周期调节保持温和，避免把周期当成“固定大幅加减热量”的硬规则。
 */
const CYCLE_ADJUSTMENTS: Record<CyclePhase, number> = {
  menstrual: 75,   // 经期适当放宽
  follicular: 0,   // 不再固定额外压热量
  ovulation: 0,
  luteal: 75,      // 黄体期适当放宽
}

export function getCycleAdjustment(phase: CyclePhase): number {
  return CYCLE_ADJUSTMENTS[phase]
}

// ── 自动活动水平检测 ──────────────────────────────────────────────────────────

/**
 * 根据最近 14 天的实际步数和训练频率，推断平均活动水平。
 * 数据不足时返回 null，让调用方回退到用户手动设置。
 *
 * 注意：
 * 这个活动水平用于 Layer 1 的“平均 TDEE”；
 * 因此 Layer 2 / 3 只做“小幅偏差修正”，不要大加。
 */
export function detectActivityLevel(logs: ExerciseLog[]): ActivityLevel | null {
  const recent = logs.slice(0, 14)
  if (recent.length < 7) return null

  const stepLogs = recent.filter((l) => l.steps !== null)
  const avgSteps = stepLogs.length
    ? stepLogs.reduce((s, l) => s + (l.steps ?? 0), 0) / stepLogs.length
    : 0

  const workoutCount = recent.filter((l) => l.workout_type !== null).length
  const workoutsPerWeek = (workoutCount / recent.length) * 7

  if (avgSteps >= 10000 || workoutsPerWeek >= 6) return 'heavy'
  if (avgSteps >= 7500 || workoutsPerWeek >= 4) return 'moderate'
  if (avgSteps >= 5000 || workoutsPerWeek >= 2) return 'light'
  return 'sedentary'
}

// ── 汇总计算 ──────────────────────────────────────────────────────────────────

// ── 数据驱动的维持热量（能量平衡）─────────────────────────────────────────────

export const KCAL_PER_KG = 7700

export interface DailyPoint {
  day: number
  weightKg: number
  intakeKcal: number
}

/**
 * 从用户「每日摄入 vs 体重变化」用能量平衡反推个人维持热量(TDEE)：
 *   TDEE = 平均摄入 − 体重斜率(kg/天) × 7700
 * 数据不足（默认 < 21 天同时有体重与摄入）时返回 null，让调用方回退到公式 TDEE。
 * 这是 analysis/adaptive_tdee.py 估计器的 TS 版——把数据科学结论接回产品。
 */
export function estimateMaintenanceTDEE(points: DailyPoint[], minDays = 21): number | null {
  const pts = points.filter((p) => Number.isFinite(p.weightKg) && Number.isFinite(p.intakeKcal))
  const n = pts.length
  if (n < minDays) return null

  // OLS：体重 ~ day，求斜率（kg/天）
  const meanDay = pts.reduce((s, p) => s + p.day, 0) / n
  const meanW = pts.reduce((s, p) => s + p.weightKg, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.day - meanDay) * (p.weightKg - meanW)
    den += (p.day - meanDay) ** 2
  }
  if (den === 0) return null
  const slopeKgPerDay = num / den
  const meanIntake = pts.reduce((s, p) => s + p.intakeKcal, 0) / n
  return Math.round(meanIntake - slopeKgPerDay * KCAL_PER_KG)
}

// ── 汇总计算 ──────────────────────────────────────────────────────────────────

export interface CalorieBreakdown {
  bmr: number
  tdee: number
  tdeeSource: 'formula' | 'data'
  minimumTarget: number
  deficit: number
  baseTarget: number
  stepAdjustment: number
  workoutAdjustment: number
  cycleAdjustment: number
  finalTarget: number
  detectedActivityLevel: ActivityLevel | null
  usedActivityLevel: ActivityLevel
  avgRecentSteps: number | null
}

/**
 * 兼容你现有的参数结构：
 * - 保留 stepTier
 * - 增加 todaySteps（推荐传）
 *
 * 如果 todaySteps 有值，优先使用“相对最近平均步数的偏差修正”
 * 如果 todaySteps 没有值，再回退到 stepTier 的旧逻辑
 */
export interface CalorieTargetParams {
  weightKg: number
  heightCm: number
  ageYears: number
  activityLevel: ActivityLevel
  weightGoalPace: WeightGoalPace
  cyclePhase: CyclePhase

  // 推荐新增：今天真实步数
  todaySteps?: number | null

  // 兼容旧字段：如果 todaySteps 没有传，则回退使用
  stepTier: StepTier | null

  workoutType: WorkoutType | null
  durationMinutes: number | null

  // 用于自动检测活动水平 & 计算最近平均步数
  recentExerciseLogs: ExerciseLog[]

  // 数据驱动的维持热量（数据足够时由 estimateMaintenanceTDEE 提供，替代公式 TDEE）
  dataTDEE?: number | null
}

export function computeDailyCalorieTarget(p: CalorieTargetParams): CalorieBreakdown {
  // 1) 自动检测“平均活动水平”
  const detectedActivityLevel = detectActivityLevel(p.recentExerciseLogs)
  const usedActivityLevel = detectedActivityLevel ?? p.activityLevel

  // 2) 基础盘：平均 TDEE -> 平均减脂热量
  const bmr = computeBMR(p.weightKg, p.heightCm, p.ageYears)
  // 数据足够时用「从用户数据学出的维持热量」，否则回退 Mifflin-St Jeor 公式
  const formulaTDEE = computeTDEE(bmr, usedActivityLevel)
  const tdee = p.dataTDEE ?? formulaTDEE
  const tdeeSource: 'formula' | 'data' = p.dataTDEE != null ? 'data' : 'formula'
  const minimumTarget = computeMinimumTarget(bmr)
  const deficit = computeDeficit(tdee, p.weightGoalPace)
  const baseTarget = computeBaseTarget(tdee, p.weightGoalPace, minimumTarget)

  // 3) 步数微调：优先用“今日 vs 最近平均”
  const avgRecentSteps = averageRecentSteps(p.recentExerciseLogs, 14)

  const stepAdjustment =
    p.todaySteps !== undefined && p.todaySteps !== null
      ? getStepAdjustmentFromDelta(p.todaySteps, p.recentExerciseLogs)
      : getLegacyStepAdjustment(p.stepTier)

  // 4) 训练微调：只补一小部分
  const workoutAdjustment = getWorkoutAdjustment(p.workoutType, p.durationMinutes)

  // 5) 周期微调：温和支持
  const cycleAdjustment = getCycleAdjustment(p.cyclePhase)

  // 6) 最终目标
  const finalTarget = Math.max(
    minimumTarget,
    Math.round(baseTarget + stepAdjustment + workoutAdjustment + cycleAdjustment)
  )

  return {
    bmr,
    tdee,
    tdeeSource,
    minimumTarget,
    deficit,
    baseTarget,
    stepAdjustment,
    workoutAdjustment,
    cycleAdjustment,
    finalTarget,
    detectedActivityLevel,
    usedActivityLevel,
    avgRecentSteps,
  }
}