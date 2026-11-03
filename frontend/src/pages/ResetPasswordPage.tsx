import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const { session, recoveryUserId, loading: authLoading, updatePassword } = useAuthStore()
  const location = useLocation()
  const parameters = [new URLSearchParams(location.hash.slice(1)), new URLSearchParams(location.search)]
  const linkFailed = parameters.some(values => ['error', 'error_code', 'error_description'].some(key => values.has(key)))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (linkFailed) throw new Error('auth.resetLinkInvalid')
      await updatePassword(password, confirm)
      setSaved(true)
    } catch (cause) {
      const key = cause instanceof Error ? cause.message : ''
      setError(['auth.passwordMin8Error', 'auth.passwordMismatch', 'auth.resetLinkInvalid'].includes(key)
        ? key : 'auth.resetFailed')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-5">
      <div className="absolute top-4 right-4"><LanguageToggle /></div>
      <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">{t('auth.forgotTitle')}</h1>
        {authLoading ? <p role="status">{t('common.loading')}</p>
          : saved ? <><p role="status">{t('auth.resetSuccess')}</p><Link to="/">{t('common.backHome')}</Link></>
          : linkFailed || !session || recoveryUserId !== session.user.id ? <><p role="alert">{t('auth.resetLinkInvalid')}</p><Link to="/auth">{t('auth.backToLogin')}</Link></>
          : <form onSubmit={submit} className="space-y-4">
            <Input label={t('auth.newPassword')} type="password" autoComplete="new-password" required
              value={password} onChange={event => setPassword(event.target.value)} />
            <Input label={t('auth.confirmPassword')} type="password" autoComplete="new-password" required
              value={confirm} onChange={event => setConfirm(event.target.value)} />
            {error && <p role="alert" className="text-sm text-red-500">{t(error)}</p>}
            <Button type="submit" fullWidth loading={saving}>{t('auth.updatePassword')}</Button>
          </form>}
      </div>
    </div>
  )
}
