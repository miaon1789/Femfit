import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { MeasurementLog } from '@/types'

interface MeasurementInputProps {
  logs: MeasurementLog[]
  onSave: (payload: Partial<MeasurementLog> & { date: string }) => Promise<void>
}

const FIELDS: { key: keyof MeasurementLog; i18nKey: string; eg: number }[] = [
  { key: 'chest_cm',   i18nKey: 'chest',  eg: 86 },
  { key: 'waist_cm',   i18nKey: 'waist',  eg: 68 },
  { key: 'navel_cm',   i18nKey: 'navel',  eg: 75 },
  { key: 'hip_cm',     i18nKey: 'hip',    eg: 92 },
  { key: 'thigh_l_cm', i18nKey: 'thighL', eg: 54 },
  { key: 'thigh_r_cm', i18nKey: 'thighR', eg: 54 },
]

export function MeasurementInput({ logs, onSave }: MeasurementInputProps) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)

  const existingLog = logs.find((l) => l.date === selectedDate) ?? null
  const latestLog = logs[0] ?? null

  const emptyFields = () => ({
    chest_cm: '', waist_cm: '', navel_cm: '',
    hip_cm: '', thigh_l_cm: '', thigh_r_cm: '',
  })

  const [values, setValues] = useState<Record<string, string>>(emptyFields())
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // 切换日期时填充已有记录
  useEffect(() => {
    const log = logs.find((l) => l.date === selectedDate) ?? null
    setValues({
      chest_cm:   log?.chest_cm?.toString()   ?? '',
      waist_cm:   log?.waist_cm?.toString()   ?? '',
      navel_cm:   log?.navel_cm?.toString()   ?? '',
      hip_cm:     log?.hip_cm?.toString()     ?? '',
      thigh_l_cm: log?.thigh_l_cm?.toString() ?? '',
      thigh_r_cm: log?.thigh_r_cm?.toString() ?? '',
    })
    setSaved(false)
    setError('')
  }, [selectedDate, logs.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const hasAny = FIELDS.some((f) => values[f.key as string])
    if (!hasAny) {
      setError(t('measureForm.errAtLeastOne'))
      return
    }

    const payload: Partial<MeasurementLog> & { date: string } = { date: selectedDate }
    for (const f of FIELDS) {
      const v = values[f.key as string]
      if (v) {
        const num = parseFloat(v)
        if (isNaN(num) || num <= 0 || num > 300) {
          setError(t('measureForm.errInvalid', { field: t(`measurements.${f.i18nKey}`) }))
          return
        }
        ;(payload as Record<string, unknown>)[f.key as string] = num
      } else {
        ;(payload as Record<string, unknown>)[f.key as string] = null
      }
    }

    setLoading(true)
    try {
      await onSave(payload)
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
        <h3 className="text-sm font-semibold text-gray-700">{t('measureForm.title')}</h3>
        <input
          type="date"
          max={today}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm text-gray-600 border border-gray-200 rounded-xl px-2 py-1 focus:outline-none focus:border-primary-400"
        />
      </div>

      {latestLog && latestLog.date !== selectedDate && (
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
          {t('measureForm.lastMeasured', { date: latestLog.date })}
          {latestLog.waist_cm && ` · ${t('measurements.waist')} ${latestLog.waist_cm} cm`}
          {latestLog.hip_cm && ` · ${t('measurements.hip')} ${latestLog.hip_cm} cm`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <Input
            key={f.key as string}
            label={t(`measurements.${f.i18nKey}`)}
            type="number"
            placeholder={t('measureForm.eg', { n: f.eg })}
            suffix="cm"
            value={values[f.key as string]}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, [f.key as string]: e.target.value }))
              setSaved(false)
            }}
          />
        ))}
      </div>

      {existingLog && !saved && (
        <p className="text-xs text-blue-500 bg-blue-50 rounded-2xl px-4 py-2 text-center">
          {t('measureForm.overwriteNote')}
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
