import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { RecordsPage } from '@/pages/RecordsPage'
import { ProfilePage } from '@/pages/ProfilePage'

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return null
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-pulse">🌸</div>
      </div>
    )
  }
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { profile, loading, fetchProfile } = useUserStore()
  const { user } = useAuthStore()
  // 追踪是否已经发起过 fetch，避免在 fetch 完成前就跳转
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user) { setChecked(true); return }
    if (profile) { setChecked(true); return }
    fetchProfile(user.id).finally(() => setChecked(true))
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!checked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-pulse">🌸</div>
      </div>
    )
  }

  if (!profile || !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

export default function App() {
  const { setSession } = useAuthStore()

  useEffect(() => {
    // 初始化时获取当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // 监听 auth 状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<GuestOnly><AuthPage /></GuestOnly>} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingFlow />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <DashboardPage />
              </RequireOnboarding>
            </RequireAuth>
          }
        />
        <Route
          path="/records/*"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <RecordsPage />
              </RequireOnboarding>
            </RequireAuth>
          }
        />
        <Route path="/analysis" element={<RequireAuth><PlaceholderPage /></RequireAuth>} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <ProfilePage />
              </RequireOnboarding>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function PlaceholderPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5">
      <div className="text-5xl">🚧</div>
      <h2 className="text-xl font-bold text-gray-700">{t('common.comingSoon')}</h2>
      <p className="text-sm text-gray-400 text-center">{t('common.comingSoonDesc')}</p>
      <Link to="/" className="text-primary-500 text-sm">{t('common.backHome')}</Link>
    </div>
  )
}
