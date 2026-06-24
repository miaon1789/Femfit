import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

type View = 'login' | 'register' | 'forgot'

export function AuthPage() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('login')

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center px-5">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌸</div>
          <h1 className="text-3xl font-bold text-primary-600">FemFit</h1>
          <p className="text-sm text-gray-400 mt-1">{t('common.appTagline')}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          {/* Tab header (only for login/register) */}
          {view !== 'forgot' && (
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-6">
              {(['login', 'register'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                    view === v
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  {v === 'login' ? t('auth.login') : t('auth.register')}
                </button>
              ))}
            </div>
          )}

          {view === 'forgot' && (
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('auth.forgotTitle')}</h2>
          )}

          {view === 'login' && (
            <LoginForm
              onSwitch={() => setView('register')}
              onForgotPassword={() => setView('forgot')}
            />
          )}
          {view === 'register' && <RegisterForm onSwitch={() => setView('login')} />}
          {view === 'forgot' && <ForgotPasswordForm onBack={() => setView('login')} />}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
          {t('auth.agreePrefix')}
          <a href="/privacy" className="text-primary-400 underline mx-1">{t('common.privacyPolicy')}</a>
          {t('auth.and')}
          <a href="/terms" className="text-primary-400 underline mx-1">{t('common.termsOfService')}</a>
        </p>
      </div>
    </div>
  )
}
