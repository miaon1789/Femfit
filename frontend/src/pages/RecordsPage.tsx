import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store/userStore'
import { useWeightLogs } from '@/hooks/useWeightLogs'
import { useExerciseLogs } from '@/hooks/useExerciseLogs'
import { useMeasurementLogs } from '@/hooks/useMeasurementLogs'
import { usePeriodLogs } from '@/hooks/usePeriodLogs'
import { WeightInput } from '@/components/weight/WeightInput'
import { WeightChart } from '@/components/weight/WeightChart'
import { WeightStats } from '@/components/weight/WeightStats'
import { ExerciseInput } from '@/components/exercise/ExerciseInput'
import { MeasurementInput } from '@/components/measurements/MeasurementInput'
import { PeriodInput } from '@/components/period/PeriodInput'
import { FoodTab } from '@/components/food/FoodTab'
import { StepsBadge } from '@/components/exercise/StepsBadge'
import { WORKOUT_TYPE_META } from '@/hooks/useExerciseLogs'
import dayjs from 'dayjs'

type Tab = 'weight' | 'exercise' | 'measurements' | 'food' | 'period'

const TABS: { key: Tab; icon: string }[] = [
  { key: 'weight',       icon: '⚖️' },
  { key: 'exercise',     icon: '🏃' },
  { key: 'measurements', icon: '📏' },
  { key: 'food',         icon: '🥗' },
  { key: 'period',       icon: '🩸' },
]

// 围度字段 → i18n key
const MEASUREMENT_FIELDS: Record<string, string> = {
  chest_cm: 'chest', waist_cm: 'waist', navel_cm: 'navel',
  hip_cm: 'hip', thigh_l_cm: 'thighL', thigh_r_cm: 'thighR',
}

export function RecordsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useUserStore()
  const [activeTab, setActiveTab] = useState<Tab>('weight')

  useEffect(() => {
    const path = location.pathname.split('/').pop()
    if (path && TABS.some((tab) => tab.key === path)) {
      setActiveTab(path as Tab)
    }
  }, [location.pathname])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    navigate(`/records/${tab}`, { replace: true })
  }

  const today = new Date().toISOString().split('T')[0]

  // ── 体重数据 ──────────────────────────────────────────────────────────────────
  const { logs: weightLogs, loading: weightLoading, addLog } = useWeightLogs(90)
  const todayWeightLog = weightLogs.find((l) => l.date === today)?.weight_kg ?? null

  // ── 运动数据 ──────────────────────────────────────────────────────────────────
  const { logs: exerciseLogs, loading: exerciseLoading, saveLog } = useExerciseLogs(30)

  // ── 围度数据 ──────────────────────────────────────────────────────────────────
  const { logs: measurementLogs, loading: measurementLoading, saveLog: saveMeasurement } = useMeasurementLogs(90)

  // ── 月经数据 ──────────────────────────────────────────────────────────────────
  const { logs: periodLogs, loading: periodLoading, addPeriod, updatePeriod } = usePeriodLogs()

  if (!profile) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 transition-colors">
          ‹ {t('records.back')}
        </button>
        <h1 className="text-lg font-bold text-gray-900">{t('records.title')}</h1>
      </header>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-[61px] z-10">
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 min-w-[64px] flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-400'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {t(`nav.${tab.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-5 py-5 max-w-md mx-auto w-full space-y-4">

        {/* ── 体重 Tab ── */}
        {activeTab === 'weight' && (
          <>
            <WeightInput onSave={addLog} todayLog={todayWeightLog} />
            {weightLoading ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl animate-pulse mb-2">⚖️</div>
                <p className="text-sm">{t('records.loading')}</p>
              </div>
            ) : (
              <>
                <WeightChart logs={weightLogs} profile={profile} />
                <WeightStats
                  logs={weightLogs}
                  targetWeight={profile.target_weight_kg}
                  heightCm={profile.height_cm}
                />
                {weightLogs.length > 0 && (
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('records.recent')}</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {[...weightLogs].reverse().slice(0, 20).map((log) => (
                        <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <span className="text-sm text-gray-500">{log.date}</span>
                          <span className="text-sm font-medium text-gray-800">{log.weight_kg.toFixed(1)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── 运动 Tab ── */}
        {activeTab === 'exercise' && (
          <>
            <ExerciseInput logs={exerciseLogs} onSave={saveLog} />
            {exerciseLoading ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl animate-pulse mb-2">🏃</div>
                <p className="text-sm">{t('records.loading')}</p>
              </div>
            ) : exerciseLogs.length > 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('records.recent')}</h3>
                <div className="space-y-3">
                  {exerciseLogs.slice(0, 14).map((log) => (
                    <div key={log.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-500">{log.date}</p>
                        {log.workout_type && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {WORKOUT_TYPE_META[log.workout_type].icon}{' '}
                            {t(`exercise.workout.${log.workout_type}`)}
                            {log.duration_minutes && ` · ${log.duration_minutes} ${t('common.minutesShort')}`}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {log.step_tier && log.steps !== null && (
                          <StepsBadge tier={log.step_tier} steps={log.steps} size="sm" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🏃</p>
                <p className="text-sm">{t('records.exerciseEmptyTitle')}</p>
                <p className="text-xs mt-1">{t('records.exerciseEmptyHint')}</p>
              </div>
            )}
          </>
        )}

        {/* ── 围度 Tab ── */}
        {activeTab === 'measurements' && (
          <>
            <MeasurementInput logs={measurementLogs} onSave={saveMeasurement} />
            {measurementLoading ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl animate-pulse mb-2">📏</div>
                <p className="text-sm">{t('records.loading')}</p>
              </div>
            ) : measurementLogs.length > 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('records.history')}</h3>
                <div className="space-y-4">
                  {measurementLogs.slice(0, 10).map((log) => {
                    const entries = Object.entries(MEASUREMENT_FIELDS)
                      .filter(([key]) => (log as unknown as Record<string, unknown>)[key] !== null)
                    return (
                      <div key={log.id} className="py-2 border-b border-gray-50 last:border-0">
                        <p className="text-sm text-gray-500 mb-1.5">{log.date}</p>
                        <div className="flex flex-wrap gap-2">
                          {entries.map(([key, i18nKey]) => (
                            <span key={key} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                              {t(`measurements.${i18nKey}`)} {(log as unknown as Record<string, unknown>)[key] as number} cm
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">📏</p>
                <p className="text-sm">{t('records.measurementsEmptyTitle')}</p>
                <p className="text-xs mt-1">{t('records.measurementsEmptyHint')}</p>
              </div>
            )}
          </>
        )}

        {/* ── 饮食 Tab ── */}
        {activeTab === 'food' && <FoodTab />}

        {/* ── 月经 Tab ── */}
        {activeTab === 'period' && (
          <>
            <PeriodInput
              onAdd={addPeriod}
              onMarkEnd={(id, endDate) => updatePeriod(id, { end_date: endDate })}
              latestLog={periodLogs[0] ?? null}
            />
            {periodLoading ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl animate-pulse mb-2">🩸</div>
                <p className="text-sm">{t('records.loading')}</p>
              </div>
            ) : periodLogs.length > 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('records.history')}</h3>
                <div className="space-y-3">
                  {periodLogs.map((log, i) => {
                    const duration = log.end_date
                      ? dayjs(log.end_date).diff(dayjs(log.start_date), 'day') + 1
                      : null
                    const cycleLen = i < periodLogs.length - 1
                      ? dayjs(log.start_date).diff(dayjs(periodLogs[i + 1].start_date), 'day')
                      : null
                    return (
                      <div key={log.id} className="py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-700">
                            {log.start_date}
                            {log.end_date ? ` ~ ${log.end_date}` : (
                              <span className="ml-1 text-xs text-rose-500 font-normal">{t('period.ongoing')}</span>
                            )}
                          </p>
                          {duration && (
                            <span className="text-xs text-gray-400">{t('period.durationDays', { n: duration })}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {log.flow_level && (
                            <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">
                              {t('period.flowTag', { level: t(`period.flowLv${log.flow_level}`) })}
                            </span>
                          )}
                          {log.pain_level && (
                            <span className="text-xs bg-violet-50 text-violet-500 px-2 py-0.5 rounded-full">
                              {t('period.painTag', { level: t(`period.painLv${log.pain_level}`) })}
                            </span>
                          )}
                          {cycleLen && (
                            <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
                              {t('period.cycleDays', { n: cycleLen })}
                            </span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-xs text-gray-400 mt-1">{log.notes}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🩸</p>
                <p className="text-sm">{t('records.periodEmptyTitle')}</p>
                <p className="text-xs mt-1">{t('records.periodEmptyHint')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
