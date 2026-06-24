// ── 用户相关 ──────────────────────────────────────────────────────────────────

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'heavy'
export type WeightGoalPace = 'slow' | 'moderate' | 'fast'

export interface UserProfile {
  id: string
  email: string
  nickname: string
  birth_year: number
  birth_month: number
  height_cm: number
  weight_kg: number
  target_weight_kg: number
  activity_level: ActivityLevel
  weight_goal_pace: WeightGoalPace
  cycle_regular: boolean
  last_period_date: string        // ISO date "YYYY-MM-DD"
  avg_cycle_days: number
  avg_period_days: number
  onboarding_completed: boolean
  subscription_tier: 'free' | 'premium'
  created_at: string
  updated_at: string
}

// ── 月经周期 ──────────────────────────────────────────────────────────────────

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

export interface PeriodLog {
  id: string
  user_id: string
  start_date: string
  end_date: string | null
  flow_level: 1 | 2 | 3 | null     // 1=轻 2=中 3=重
  pain_level: 1 | 2 | 3 | null
  mood: string | null
  notes: string | null
  created_at: string
}

export interface CycleInfo {
  phase: CyclePhase
  dayOfCycle: number
  predictedNextPeriod: string  // ISO "YYYY-MM-DD"；展示时按语言格式化
  predictedOvulation: string   // ISO "YYYY-MM-DD"
}

// ── 体重 ──────────────────────────────────────────────────────────────────────

export interface WeightLog {
  id: string
  user_id: string
  date: string
  weight_kg: number
  created_at: string
}

// ── 围度 ──────────────────────────────────────────────────────────────────────

export interface MeasurementLog {
  id: string
  user_id: string
  date: string
  chest_cm: number | null
  waist_cm: number | null
  navel_cm: number | null
  hip_cm: number | null
  thigh_l_cm: number | null
  thigh_r_cm: number | null
  created_at: string
}

// ── 饮食 ──────────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealLog {
  id: string
  user_id: string
  date: string
  meal_type: MealType
  created_at: string
  food_entries?: FoodEntry[]
}

export interface FoodEntry {
  id: string
  meal_log_id: string
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  iron_mg: number
}

export interface FoodItem {
  id: string
  name: string
  serving_size: number
  serving_unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  iron_mg: number
  category: string
  is_user_created?: boolean
}

// ── 运动记录 ──────────────────────────────────────────────────────────────────

export type StepTier = 'low' | 'normal' | 'high' | 'very_high'
export type WorkoutType = 'strength' | 'cardio' | 'hiit' | 'yoga' | 'other'

export interface ExerciseLog {
  id: string
  user_id: string
  date: string
  steps: number | null
  step_tier: StepTier | null
  workout_type: WorkoutType | null
  duration_minutes: number | null
  heart_rate_avg: number | null
  watch_calories: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── AI 报告 ───────────────────────────────────────────────────────────────────

export type ReportType = 'daily_analysis' | 'weekly_report' | 'meal_analysis'

export interface AiReport {
  id: string
  user_id: string
  type: ReportType
  content: string
  generated_at: string
  metadata?: Record<string, unknown>
}
