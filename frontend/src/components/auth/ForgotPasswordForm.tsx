import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ForgotPasswordFormProps {
  onBack: () => void
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { t } = useTranslation()
  const { resetPassword } = useAuthStore()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center flex flex-col gap-4">
        <div className="text-5xl">✉️</div>
        <h3 className="text-lg font-semibold">{t('auth.resetSentTitle')}</h3>
        <p className="text-sm text-gray-500">{t('auth.resetSentBody', { email })}</p>
        <Button variant="secondary" fullWidth onClick={onBack}>{t('auth.backToLogin')}</Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">{t('auth.forgotIntro')}</p>
      <Input
        label={t('common.email')}
        type="email"
        placeholder={t('auth.forgotEmailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-2xl px-4 py-2">{error}</p>
      )}
      <Button type="submit" fullWidth size="lg" loading={loading}>{t('auth.sendResetEmail')}</Button>
      <button type="button" onClick={onBack} className="text-sm text-gray-500 text-center">
        {t('auth.backToLogin')}
      </button>
    </form>
  )
}
