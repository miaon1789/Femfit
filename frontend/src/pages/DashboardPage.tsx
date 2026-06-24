import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useWeightLogs } from '@/hooks/useWeightLogs'
import { useExerciseLogs, WORKOUT_TYPE_META } from '@/hooks/useExerciseLogs'
import { useCalorieTarget } from '@/hooks/useCalorieTarget'
import { useFoodLogs } from '@/hooks/useFoodLogs'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { StepsBadge } from '@/components/exercise/StepsBadge'
import { computeCycleInfo } from '@/lib/cycleEngine'
import { formatDateLong, formatDateShort } from '@/lib/formatDate'
import dayjs from 'dayjs'

const PHASE_META = {
  menstrual:  { emoji: '🔴', gradient: 'from-rose-400 to-rose-500' },
  follicular: { emoji: '🟢', gradient: 'from-emerald-400 to-emerald-500' },
  ovulation:  { emoji: '🟡', gradient: 'from-amber-400 to-amber-500' },
  luteal:     { emoji: '🟣', gradient: 'from-violet-400 to-violet-500' },
}

// 热量调整数值的显示样式
function AdjustChip({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full ${
      positive ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
    }`}>
      {positive ? '+' : ''}{value} {label}
    </span>
  )
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { user, signOut } = useAuthStore()
  const { profile, fetchProfile, loading } = useUserStore()
  const navigate = useNavigate()

  const today = dayjs().format('YYYY-MM-DD')
  const { logs: weightLogs } = useWeightLogs(7)
  const { logs: exerciseLogs } = useExerciseLogs(14)
  const calorieTarget = useCalorieTarget()
  const { totalCalories: todayIntake } = useFoodLogs(today)

  useEffect(() => {
    if (user && !profile) fetchProfile(user.id)
  }, [user, profile, fetchProfile])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-pulse mb-2">🌸</div>
          <p className="text-gray-400 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!profile) return null

  // ── 周期信息 ────────────────────────────────────────────────────────────────
  const cycleInfo = computeCycleInfo(
    profile.last_period_date,
    profile.avg_cycle_days,
    profile.avg_period_days
  )
  const phaseMeta = PHASE_META[cycleInfo.phase]

  // ── 体重 ────────────────────────────────────────────────────────────────────
  const todayWeight = weightLogs.find((l) => l.date === today)?.weight_kg ?? null
  const latestWeight = weightLogs.at(-1)?.weight_kg ?? profile.weight_kg
  const bmi = (latestWeight / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
  const toGoal = (latestWeight - profile.target_weight_kg).toFixed(1)
  const bmiLabel = parseFloat(bmi) < 18.5 ? t('dashboard.bmiUnder')
    : parseFloat(bmi) < 24 ? t('dashboard.bmiNormal')
    : parseFloat(bmi) < 28 ? t('dashboard.bmiOver')
    : t('dashboard.bmiObese')

  // ── 今日运动 ────────────────────────────────────────────────────────────────
  const todayExercise = exerciseLogs.find((l) => l.date === today) ?? null
  const isWorkoutDay = !!todayExercise?.workout_type
  const isRestDay = todayExercise !== null && !todayExercise.workout_type

  const quickActions = [
    { icon: '⚖️', label: t('nav.weight'),       path: '/records/weight' },
    { icon: '🏃', label: t('nav.exercise'),     path: '/records/exercise' },
    { icon: '📏', label: t('nav.measurements'), path: '/records/measurements' },
    { icon: '🥗', label: t('nav.food'),         path: '/records/food' },
    { icon: '🩸', label: t('nav.period'),       path: '/records/period' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-400">{formatDateLong(dayjs(), lang)}</p>
          <h1 className="text-lg font-bold text-gray-900">{t('dashboard.greeting', { name: profile.nickname })}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm"
          >
            {profile.nickname.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <div className="px-5 pt-5 max-w-md mx-auto space-y-4">

        {/* ── 周期阶段卡片 ── */}
        <Card className={`bg-gradient-to-br ${phaseMeta.gradient} text-white border-0`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/70 text-xs mb-1">{t('dashboard.currentPhase', { day: cycleInfo.dayOfCycle })}</p>
              <h2 className="text-2xl font-bold mb-1">{t(`cycle.phase.${cycleInfo.phase}`)}</h2>
              <p className="text-white/80 text-sm leading-relaxed max-w-[220px]">{t(`cycle.tip.${cycleInfo.phase}`)}</p>
            </div>
            <span className="text-4xl">{phaseMeta.emoji}</span>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-white/70">
            <span>{t('dashboard.nextPeriod', { date: formatDateShort(cycleInfo.predictedNextPeriod, lang) })}</span>
            <span>{t('dashboard.ovulation', { date: formatDateShort(cycleInfo.predictedOvulation, lang) })}</span>
          </div>
        </Card>

        {/* ── 体重 + BMI ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-gray-400 mb-1">{todayWeight ? t('dashboard.todayWeight') : t('dashboard.recentWeight')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {latestWeight.toFixed(1)}
              <span className="text-sm text-gray-400 ml-1">kg</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {parseFloat(toGoal) > 0 ? t('dashboard.toGoal', { kg: toGoal }) : t('dashboard.goalReached')}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 mb-1">BMI</p>
            <p className="text-2xl font-bold text-gray-900">{bmi}</p>
            <p className="text-xs text-gray-400 mt-1">{bmiLabel}</p>
          </Card>
        </div>

        {/* ── 今日热量目标卡片 ── */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">{t('dashboard.calorieTarget')}</p>
            <div className="flex items-center gap-1.5">
              {calorieTarget?.tdeeSource === 'data' && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {t('dashboard.tdeeFromData')}
                </span>
              )}
              {calorieTarget?.detectedActivityLevel && (
                <span className="text-xs text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">
                  {t('dashboard.autoActivity', { level: t(`activity.${calorieTarget.detectedActivityLevel}`) })}
                </span>
              )}
            </div>
          </div>

          {calorieTarget ? (
            <>
              {/* 目标数值 */}
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-gray-900">
                  {calorieTarget.finalTarget.toLocaleString()}
                </span>
                <span className="text-sm text-gray-400">kcal</span>
              </div>

              {/* 调整拆解 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                  {t('dashboard.base', { value: calorieTarget.baseTarget })}
                </span>
                <AdjustChip label={t('dashboard.adjSteps')} value={calorieTarget.stepAdjustment} />
                <AdjustChip label={t('dashboard.adjWorkout')} value={calorieTarget.workoutAdjustment} />
                <AdjustChip label={t('dashboard.adjCycle')} value={calorieTarget.cycleAdjustment} />
              </div>

              {/* 摄入进度 */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    todayIntake >= calorieTarget.finalTarget ? 'bg-amber-400' : 'bg-primary-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((todayIntake / calorieTarget.finalTarget) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                <span>{todayIntake > 0 ? t('dashboard.intakeSoFar', { kcal: todayIntake.toLocaleString() }) : t('dashboard.noIntake')}</span>
                <span>{t('dashboard.remaining', { kcal: Math.max(0, calorieTarget.finalTarget - todayIntake).toLocaleString() })}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('dashboard.calculating')}</p>
          )}
        </Card>

        {/* ── 今日运动摘要卡片 ── */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">{t('dashboard.todayExercise')}</p>
            {/* 训练日 / 休息日标识 */}
            {isWorkoutDay && (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {t('dashboard.workoutDay')}
              </span>
            )}
            {isRestDay && (
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                {t('dashboard.restDay')}
              </span>
            )}
          </div>

          {todayExercise ? (
            <div className="space-y-2">
              {/* 步数 */}
              {todayExercise.steps !== null && todayExercise.step_tier && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t('dashboard.todaySteps')}</span>
                  <StepsBadge
                    tier={todayExercise.step_tier}
                    steps={todayExercise.steps}
                    size="sm"
                  />
                </div>
              )}
              {/* 训练 */}
              {todayExercise.workout_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t('dashboard.workoutLabel')}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {WORKOUT_TYPE_META[todayExercise.workout_type].icon}{' '}
                    {t(`exercise.workout.${todayExercise.workout_type}`)}
                    {todayExercise.duration_minutes && ` · ${todayExercise.duration_minutes} ${t('common.minutesShort')}`}
                  </span>
                </div>
              )}
              {/* 活动水平对热量目标的影响提示 */}
              {calorieTarget && (calorieTarget.stepAdjustment !== 0 || calorieTarget.workoutAdjustment !== 0) && (
                <p className="text-xs text-gray-400 pt-1 border-t border-gray-50">
                  {t('dashboard.exerciseBoost')}{' '}
                  <span className="text-green-600 font-medium">
                    +{calorieTarget.stepAdjustment + calorieTarget.workoutAdjustment} kcal
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t('dashboard.noExercise')}</p>
              <button
                onClick={() => navigate('/records/exercise')}
                className="text-xs text-primary-500 font-medium"
              >
                {t('dashboard.logNow')}
              </button>
            </div>
          )}
        </Card>

        {/* ── 快捷记录 ── */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.quickLog')}</p>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map(({ icon, label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-2 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-primary-200 active:scale-95 transition-all"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-xs text-gray-600">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 退出登录（开发期保留） */}
        <Button variant="ghost" fullWidth onClick={signOut} className="text-gray-300 text-xs">
          {t('common.logout')}
        </Button>
      </div>
    </div>
  )
}
