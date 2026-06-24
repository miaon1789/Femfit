import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface WeightInputProps {
  onSave: (weightKg: number, date: string) => Promise<void>
  todayLog?: number | null  // 今天已有记录
}

export function WeightInput({ onSave, todayLog }: WeightInputProps) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [weight, setWeight] = useState(todayLog ? String(todayLog) : '')
  const [date, setDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const w = parseFloat(weight)
    if (!w || w < 20 || w > 300) { setError(t('weight.errInvalid')); return }
    setLoading(true)
    try {
      await onSave(w, date)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t('common.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('weight.logTitle')}</h3>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label={t('weight.label')}
            type="number"
            step="0.1"
            placeholder="55.0"
            suffix="kg"
            value={weight}
            onChange={(e) => { setWeight(e.target.value); setSaved(false) }}
            error={error}
          />
        </div>
        <div className="flex-1">
          <Input
            label={t('common.date')}
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          loading={loading}
          className="mb-0.5 shrink-0"
        >
          {saved ? t('common.saved') : t('common.save')}
        </Button>
      </div>
      {todayLog && date === today && (
        <p className="text-xs text-gray-400 mt-2">
          {t('weight.todayNote', { w: todayLog })}
        </p>
      )}
    </form>
  )
}
