/**
 * calorieEngine.ts
 *
 * Four-layer calorie target model:
 *   Layer 1  Base target = average TDEE - calorie deficit
 *   Layer 2  Step adjustment = small correction against recent average steps
 *   Layer 3  Workout adjustment = partial replacement of workout energy
 *   Layer 4  Cycle adjustment = gentle correction for the current phase
 *
 * Final target = sum of all four layers, floored at the individual minimum.
 */

import type {
  ActivityLevel,
  WeightGoalPace,
  CyclePhase,
  StepTier,
  WorkoutType,
} from '@/types'
import type { ExerciseLog } from '@/types'

// Layer 1: base calorie target

/**
 * Mifflin-St Jeor equation for women
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
 * Calorie deficit
 * slow: 200 to 350 kcal, moderate: 400 to 600 kcal, fast: 500 to 750 kcal
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
 * Individual minimum target:
 *  1) 1200
 *  2) 90% of BMR
 */
export function computeMinimumTarget(bmr: number): number {
  return Math.round(Math.max(1200, bmr * 0.9))
}

export function computeBaseTarget(tdee: number, pace: WeightGoalPace, minimumTarget: number): number {
  const deficit = computeDeficit(tdee, pace)
  return Math.max(minimumTarget, tdee - deficit)
}

// Layer 2: step adjustment (NEAT)

/**
 * Legacy StepTier adjustment when today's step count is unavailable.
 * Keep corrections small to avoid double-counting activity from Layer 1.
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
 * Adjust today's steps relative to the recent average.
 * This avoids counting an already active baseline twice.
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

// Layer 3: workout adjustment

/**
 * Replace only a small fraction of workout energy.
 * Watch calorie estimates are not used because they can be imprecise.
 */
export function getWorkoutAdjustment(
  workoutType: WorkoutType | null,
  durationMinutes: number | null
): number {
  if (!workoutType || !durationMinutes || durationMinutes <= 0) return 0

  const dur = durationMinutes

  switch (workoutType) {
    case 'strength':
      // Strength training: a small allowance for recovery.
      return dur < 45 ? 50 : 80

    case 'hiit':
      // HIIT: slightly above strength training, still conservative.
      return dur < 30 ? 70 : 100

    case 'cardio':
      // Cardio: scale by duration.
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

// Layer 4: cycle adjustment

/**
 * Keep cycle adjustments modest instead of applying large fixed changes.
 */
const CYCLE_ADJUSTMENTS: Record<CyclePhase, number> = {
  menstrual: 75,   // Small menstrual allowance.
  follicular: 0,   // No additional fixed deficit.
  ovulation: 0,
  luteal: 75,      // Small luteal allowance.
}

export function getCycleAdjustment(phase: CyclePhase): number {
  return CYCLE_ADJUSTMENTS[phase]
}

// Automatic activity-level detection

/**
 * Infer average activity from the latest 14 days of steps and workout frequency.
 * Return null when history is insufficient so the caller can use the profile setting.
 *
 * Note:
 * This activity level sets average TDEE in Layer 1.
 * Layers 2 and 3 therefore apply only small corrections.
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

// Combined calculation

// Maintenance calories from energy balance

export const KCAL_PER_KG = 7700

export interface DailyPoint {
  day: number
  weightKg: number
  intakeKcal: number
}

/**
 * Estimate personal maintenance calories (TDEE) from intake and weight change:
 *   TDEE = mean intake - weight slope (kg/day) * 7700
 * Return null below minDays (default 21) of paired weight and intake observations.
 * TypeScript counterpart of analysis/adaptive_tdee.py, feeding the estimate into the app.
 */
export function estimateMaintenanceTDEE(points: DailyPoint[], minDays = 21): number | null {
  const pts = points.filter((p) => Number.isFinite(p.weightKg) && Number.isFinite(p.intakeKcal))
  const n = pts.length
  if (n < minDays) return null

  // OLS: regress weight on day to estimate the slope in kg/day.
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

// Combined calculation

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
 * Preserve compatibility with the existing parameters:
 * - Keep stepTier.
 * - Prefer todaySteps when available.
 *
 * When todaySteps is available, use its deviation from the recent average.
 * Otherwise fall back to the legacy stepTier adjustment.
 */
export interface CalorieTargetParams {
  weightKg: number
  heightCm: number
  ageYears: number
  activityLevel: ActivityLevel
  weightGoalPace: WeightGoalPace
  cyclePhase: CyclePhase | null

  // Today's actual step count, preferred when available.
  todaySteps?: number | null

  // Legacy fallback when todaySteps is not supplied.
  stepTier: StepTier | null

  workoutType: WorkoutType | null
  durationMinutes: number | null

  // Used for activity detection and the recent step average.
  recentExerciseLogs: ExerciseLog[]

  // Replaces formula TDEE when estimateMaintenanceTDEE has enough observations.
  dataTDEE?: number | null
}

export function computeDailyCalorieTarget(p: CalorieTargetParams): CalorieBreakdown {
  // 1) Detect average activity level.
  const detectedActivityLevel = detectActivityLevel(p.recentExerciseLogs)
  const usedActivityLevel = detectedActivityLevel ?? p.activityLevel

  // 2) Convert average TDEE into the base calorie target.
  const bmr = computeBMR(p.weightKg, p.heightCm, p.ageYears)
  // Use observed maintenance calories when available, otherwise the formula estimate.
  const formulaTDEE = computeTDEE(bmr, usedActivityLevel)
  const tdee = p.dataTDEE ?? formulaTDEE
  const tdeeSource: 'formula' | 'data' = p.dataTDEE != null ? 'data' : 'formula'
  const minimumTarget = computeMinimumTarget(bmr)
  const deficit = computeDeficit(tdee, p.weightGoalPace)
  const baseTarget = computeBaseTarget(tdee, p.weightGoalPace, minimumTarget)

  // 3) Prefer a step correction relative to the recent average.
  const avgRecentSteps = averageRecentSteps(p.recentExerciseLogs, 14)

  const stepAdjustment =
    p.todaySteps !== undefined && p.todaySteps !== null
      ? getStepAdjustmentFromDelta(p.todaySteps, p.recentExerciseLogs)
      : getLegacyStepAdjustment(p.stepTier)

  // 4) Replace a small fraction of workout energy.
  const workoutAdjustment = getWorkoutAdjustment(p.workoutType, p.durationMinutes)

  // 5) Apply a gentle cycle adjustment.
  const cycleAdjustment = p.cyclePhase ? getCycleAdjustment(p.cyclePhase) : 0

  // 6) Apply the minimum to the final target.
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
