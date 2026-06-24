import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface LoginFormProps {
  onSwitch: () => void
  onForgotPassword: () => void
}

export function LoginForm({ onSwitch, onForgotPassword }: LoginFormProps) {
  const { t } = useTranslation()
  const { signIn } = useAuthStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.loginFailed')
      if (msg.includes('Invalid login credentials')) {
        setError(t('auth.invalidCredentials'))
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
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
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      {error && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-2xl px-4 py-2">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onForgotPassword}
        className="text-sm text-primary-500 text-right -mt-2"
      >
        {t('auth.forgotLink')}
      </button>
      <Button type="submit" fullWidth size="lg" loading={loading}>
        {t('auth.login')}
      </Button>
      <p className="text-center text-sm text-gray-500">
        {t('auth.noAccount')}{' '}
        <button type="button" onClick={onSwitch} className="text-primary-500 font-medium">
          {t('auth.signUpNow')}
        </button>
      </p>
    </form>
  )
}
