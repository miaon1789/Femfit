import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface RegisterFormProps {
  onSwitch: () => void
}

export function RegisterForm({ onSwitch }: RegisterFormProps) {
  const { t } = useTranslation()
  const { signUp } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(t('auth.passwordMin8Error'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setLoading(true)
    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.registerFailed')
      if (msg.includes('already registered')) {
        setError(t('auth.alreadyRegistered'))
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center flex flex-col gap-4">
        <div className="text-5xl">📬</div>
        <h3 className="text-lg font-semibold text-gray-800">{t('auth.registerSuccessTitle')}</h3>
        <p className="text-sm text-gray-500">
          {t('auth.verifyEmailSent', { email })}
        </p>
        <Button variant="secondary" fullWidth onClick={onSwitch}>
          {t('auth.goLogin')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t('common.email')}
        type="email"
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Input
        label={t('common.password')}
        type="password"
        placeholder={t('auth.passwordMin8Placeholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Input
        label={t('auth.confirmPassword')}
        type="password"
        placeholder={t('auth.confirmPasswordPlaceholder')}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      {error && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-2xl px-4 py-2">
          {error}
        </p>
      )}
      <Button type="submit" fullWidth size="lg" loading={loading}>
        {t('auth.register')}
      </Button>
      <p className="text-center text-sm text-gray-500">
        {t('auth.haveAccount')}{' '}
        <button type="button" onClick={onSwitch} className="text-primary-500 font-medium">
          {t('auth.loginNow')}
        </button>
      </p>
    </form>
  )
}
