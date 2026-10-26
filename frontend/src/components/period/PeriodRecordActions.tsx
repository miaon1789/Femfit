import { useState } from 'react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import type { PeriodLog } from '@/types'
import type { PeriodPayload } from '@/hooks/usePeriodLogs'

interface Props {
  log: PeriodLog
  onUpdate: (id: string, payload: PeriodPayload) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

export function PeriodRecordActions({ log, onUpdate, onDelete }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [draft, setDraft] = useState<PeriodPayload>(log)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = dayjs().format('YYYY-MM-DD')
  const fieldClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700'
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.start_date || draft.start_date > today ||
      (draft.end_date && (draft.end_date < draft.start_date || draft.end_date > today))) {
      setError(t('period.errDates')); return
    }
    setBusy(true)
    try {
      await onUpdate(log.id, { start_date: draft.start_date, end_date: draft.end_date || null,
        flow_level: draft.flow_level, pain_level: draft.pain_level, notes: draft.notes?.trim() || null })
      setMode('view')
    } catch { setError(t('period.errUpdate')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setError(''); setBusy(true)
    try { await onDelete(log.id); setMode('view') }
    catch { setError(t('period.errDelete')) }
    finally { setBusy(false) }
  }
  return <div className="mt-3 space-y-2">
    {mode === 'view' && <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => {
        setDraft(log); setError(''); setMode('edit')
      }}>{t('period.edit')}</Button>
      <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => {
        setError(''); setMode('delete')
      }}>{t('period.delete')}</Button>
    </div>}
    {mode === 'edit' && <form onSubmit={save} className="rounded-2xl bg-gray-50 p-3 space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs text-gray-600">{t('period.startDate')}
          <input className={fieldClass} type="date" required max={today} value={draft.start_date}
            onChange={event => setDraft({ ...draft, start_date: event.target.value })} />
        </label>
        <label className="block text-xs text-gray-600">{t('period.endOptional')}
          <input className={fieldClass} type="date" min={draft.start_date} max={today} value={draft.end_date ?? ''}
            onChange={event => setDraft({ ...draft, end_date: event.target.value || null })} />
        </label>
        {(['flow_level', 'pain_level'] as const).map(field => <label key={field} className="block text-xs text-gray-600">
          {t(field === 'flow_level' ? 'period.flowOptional' : 'period.painOptional')}
          <select aria-label={t(field === 'flow_level' ? 'period.flowOptional' : 'period.painOptional')} className={fieldClass} value={draft[field] ?? ''}
            onChange={event => setDraft({ ...draft, [field]: event.target.value ? Number(event.target.value) as 1 | 2 | 3 : null })}>
            <option value="">{t('period.notRecorded')}</option>
            {[1, 2, 3].map(value => <option key={value} value={value}>
              {t(`period.${field === 'flow_level' ? 'flow' : 'pain'}Lv${value}`)}
            </option>)}
          </select>
        </label>)}
        <label className="block text-xs text-gray-600">{t('period.notes')}
          <textarea aria-label={t('period.notes')} className={fieldClass} value={draft.notes ?? ''} rows={2}
            onChange={event => setDraft({ ...draft, notes: event.target.value })} />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={busy}>{t('common.save')}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setMode('view'); setError('') }}>{t('period.cancel')}</Button>
        </div>
      </fieldset>
    </form>}
    {mode === 'delete' && <div className="rounded-2xl bg-red-50 p-3 space-y-3">
      <p className="text-sm text-red-700">{t('period.confirmDelete')}</p>
      <div className="flex gap-2">
        <Button type="button" variant="danger" size="sm" loading={busy} onClick={remove}>{t('period.deleteConfirm')}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setMode('view'); setError('') }}>{t('period.cancel')}</Button>
      </div>
    </div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}
