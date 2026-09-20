import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { PeriodLog } from '@/types'

interface PeriodInputProps {
  onAdd: (payload: {
    start_date: string
    end_date?: string | null
    flow_level?: 1 | 2 | 3 | null
    pain_level?: 1 | 2 | 3 | null
    notes?: string | null
  }) => Promise<unknown>
  onMarkEnd: (id: string, endDate: string) => Promise<unknown>
  latestLog: PeriodLog | null
}

const LEVELS = [1, 2, 3] as const

export function PeriodInput({ onAdd, onMarkEnd, latestLog }: PeriodInputProps) {
  const { t } = useTranslation()
  const today = dayjs().format('YYYY-MM-DD')

  // 是否有进行中的月经（没有 end_date）
  const isOngoing = latestLog !== null && !latestLog.end_date

  const [startDate, setStartDate] = useState(today)
  const [flowLevel, setFlowLevel] = useState<1 | 2 | 3 | null>(null)
  const [painLevel, setPainLevel] = useState<1 | 2 | 3 | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // 结束月经
  const [endLoading, setEndLoading] = useState(false)
  const [endDate, setEndDate] = useState(today)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!startDate) { setError(t('period.errStartDate')); return }
    if (isOngoing) { setError(t('period.errOngoing')); return }

    setLoading(true)
    try {
      await onAdd({
        start_date: startDate,
        flow_level: flowLevel,
        pain_level: painLevel,
        notes: notes.trim() || null,
      })
      setSaved(true)
      setFlowLevel(null)
      setPainLevel(null)
      setNotes('')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t('common.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleMarkEnd = async () => {
    if (!latestLog) return
    setEndLoading(true)
    try {
      await onMarkEnd(latestLog.id, endDate)
    } catch {
      setError(t('period.errUpdate'))
    } finally {
      setEndLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 进行中的月经 → 标记结束 */}
      {isOngoing && (
        <div className="bg-rose-50 rounded-3xl border border-rose-100 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🩸</span>
            <div>
              <p className="text-sm font-semibold text-rose-700">{t('period.ongoingTitle')}</p>
              <p className="text-xs text-rose-400">{t('period.startedOn', { date: latestLog!.start_date })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">{t('period.endDate')}</label>
              <input
                type="date"
                min={latestLog!.start_date}
                max={today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleMarkEnd}
              loading={endLoading}
              className="mt-5 border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              {t('period.markEnd')}
            </Button>
          </div>
        </div>
      )}

      {/* 新增月经记录 */}
      <form onSubmit={handleAdd} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-5">
        <h3 className="text-sm font-semibold text-gray-700">
          {isOngoing ? t('period.logNextTitle') : t('period.logNewTitle')}
        </h3>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">{t('period.startDate')}</label>
          <input
            type="date"
            max={today}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-400"
          />
        </div>

        {/* 经量 */}
        <div>
          <p className="text-xs text-gray-500 mb-2">{t('period.flowOptional')}</p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFlowLevel(flowLevel === value ? null : value)}
                className={`flex flex-col items-center py-2.5 rounded-xl border-2 transition-all ${
                  flowLevel === value
                    ? 'border-rose-400 bg-rose-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <span className="text-sm font-semibold text-gray-700">{t(`period.flowLv${value}`)}</span>
                <span className="text-xs text-gray-400">{t(`period.flowDesc${value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 疼痛 */}
        <div>
          <p className="text-xs text-gray-500 mb-2">{t('period.painOptional')}</p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPainLevel(painLevel === value ? null : value)}
                className={`flex flex-col items-center py-2.5 rounded-xl border-2 transition-all ${
                  painLevel === value
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <span className="text-sm font-semibold text-gray-700">{t(`period.painLv${value}`)}</span>
                <span className="text-xs text-gray-400">{t(`period.painDesc${value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t('period.notes')}
          placeholder={t('period.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-2 text-center">{error}</p>
        )}

        <Button type="submit" fullWidth loading={loading} disabled={isOngoing}>
          {saved ? t('period.logged') : isOngoing ? t('period.endFirst') : t('period.logBtn')}
        </Button>
      </form>
    </div>
  )
}
