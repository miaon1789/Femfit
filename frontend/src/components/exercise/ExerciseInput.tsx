import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StepsBadge } from './StepsBadge'
import { getStepTier, WORKOUT_TYPE_META } from '@/hooks/useExerciseLogs'
import type { ExerciseLog, WorkoutType, StepTier } from '@/types'

const STEP_DESC_KEY: Record<StepTier, string> = {
  low: 'exerciseForm.stepDescLow',
  normal: 'exerciseForm.stepDescNormal',
  high: 'exerciseForm.stepDescHigh',
  very_high: 'exerciseForm.stepDescVeryHigh',
}

interface ExerciseInputProps {
  logs: ExerciseLog[]
  onSave: (payload: Partial<ExerciseLog> & { date: string }) => Promise<void>
}

export function ExerciseInput({ logs, onSave }: ExerciseInputProps) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)

  const existingLog = logs.find((l) => l.date === selectedDate) ?? null

  // ── 步数 ─────────────────────────────────────────────────────────────────────
  const [steps, setSteps] = useState(existingLog?.steps?.toString() ?? '')

  // ── 训练记录 ──────────────────────────────────────────────────────────────────
  const [hasWorkout, setHasWorkout] = useState(!!existingLog?.workout_type)
  const [workoutType, setWorkoutType] = useState<WorkoutType | ''>(existingLog?.workout_type ?? '')
  const [duration, setDuration] = useState(existingLog?.duration_minutes?.toString() ?? '')
  const [heartRate, setHeartRate] = useState(existingLog?.heart_rate_avg?.toString() ?? '')
  const [watchCals, setWatchCals] = useState(existingLog?.watch_calories?.toString() ?? '')
  const [notes, setNotes] = useState(existingLog?.notes ?? '')

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // 切换日期时，用该日期的已有记录填充表单
  useEffect(() => {
    const log = logs.find((l) => l.date === selectedDate) ?? null
    setSteps(log?.steps?.toString() ?? '')
    setHasWorkout(!!log?.workout_type)
    setWorkoutType(log?.workout_type ?? '')
    setDuration(log?.duration_minutes?.toString() ?? '')
    setHeartRate(log?.heart_rate_avg?.toString() ?? '')
    setWatchCals(log?.watch_calories?.toString() ?? '')
    setNotes(log?.notes ?? '')
    setSaved(false)
    setError('')
  }, [selectedDate, logs.length])

  const stepsNum = steps ? parseInt(steps) : null
  const stepTier = stepsNum !== null && stepsNum >= 0 ? getStepTier(stepsNum) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!steps && !hasWorkout) {
      setError(t('exerciseForm.errStepsOrWorkout'))
      return
    }
    if (stepsNum !== null && (stepsNum < 0 || stepsNum > 100000)) {
      setError(t('exerciseForm.errStepsRange'))
      return
    }
    if (hasWorkout && !workoutType) {
      setError(t('exerciseForm.errSelectType'))
      return
    }
    if (hasWorkout && !duration) {
      setError(t('exerciseForm.errDuration'))
      return
    }

    setLoading(true)
    try {
      await onSave({
        date: selectedDate,
        steps: stepsNum,
        workout_type: hasWorkout ? workoutType as WorkoutType : null,
        duration_minutes: hasWorkout && duration ? parseInt(duration) : null,
        heart_rate_avg: heartRate ? parseInt(heartRate) : null,
        watch_calories: watchCals ? parseInt(watchCals) : null,
        notes: notes.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t('common.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('exerciseForm.title')}</h3>
        <input
          type="date"
          max={today}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm text-gray-600 border border-gray-200 rounded-xl px-2 py-1 focus:outline-none focus:border-primary-400"
        />
      </div>

      {/* ── 步数 ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">{t('exerciseForm.steps')}</p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              type="number"
              placeholder={t('exerciseForm.stepsPlaceholder')}
              suffix={t('common.stepsUnit')}
              value={steps}
              onChange={(e) => { setSteps(e.target.value); setSaved(false) }}
            />
          </div>
          {stepTier && <StepsBadge tier={stepTier} />}
        </div>
        {stepTier && (
          <p className="text-xs text-gray-400">
            {t(STEP_DESC_KEY[stepTier])}
            {stepTier === 'low' && t('exerciseForm.lowHint')}
            {stepTier === 'very_high' && t('exerciseForm.highHint')}
          </p>
        )}
      </div>

      {/* ── 训练记录 ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600">{t('exerciseForm.workoutOptional')}</p>
          <button
            type="button"
            onClick={() => setHasWorkout((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors ${hasWorkout ? 'bg-primary-500' : 'bg-gray-200'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${hasWorkout ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {hasWorkout && (
          <div className="space-y-3 pt-1">
            {/* 训练类型 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">{t('exerciseForm.workoutType')}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.entries(WORKOUT_TYPE_META) as [WorkoutType, { icon: string }][]).map(([type, meta]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setWorkoutType(type)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                      workoutType === type
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <span className="text-[10px] text-gray-600 leading-tight text-center">{t(`exercise.workout.${type}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 时长 */}
            <Input
              label={t('exerciseForm.duration')}
              type="number"
              placeholder="45"
              suffix={t('common.minutesShort')}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />

            {/* 可选项 */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('exerciseForm.avgHr')}
                type="number"
                placeholder="140"
                suffix="bpm"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
              />
              <Input
                label={t('exerciseForm.watchCals')}
                type="number"
                placeholder="350"
                suffix="kcal"
                value={watchCals}
                onChange={(e) => setWatchCals(e.target.value)}
                hint={t('exerciseForm.watchRef')}
              />
            </div>
            {watchCals && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                {t('exerciseForm.watchWarning')}
              </p>
            )}

            <Input
              label={t('exerciseForm.notes')}
              placeholder={t('exerciseForm.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      {existingLog && !saved && (
        <p className="text-xs text-blue-500 bg-blue-50 rounded-2xl px-4 py-2 text-center">
          {t('exerciseForm.overwriteNote')}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-2 text-center">{error}</p>
      )}

      <Button type="submit" fullWidth loading={loading}>
        {saved ? t('common.saved') : t('common.save')}
      </Button>
    </form>
  )
}
