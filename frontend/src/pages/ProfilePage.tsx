import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { exportUserDataCsv } from '@/lib/exportData'

export function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { profile } = useUserStore()
  const [exporting, setExporting] = useState(false)
  const [msg, setMsg] = useState('')

  if (!profile || !user) return null

  const handleExport = async () => {
    setExporting(true)
    setMsg('')
    try {
      const n = await exportUserDataCsv(user.id, profile)
      setMsg(n > 0 ? t('profile.exportedN', { n }) : t('profile.exportEmpty'))
    } catch {
      setMsg(t('common.saveFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 transition-colors">
            ‹ {t('records.back')}
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('profile.title')}</h1>
        </div>
        <LanguageToggle />
      </header>

      <div className="px-5 pt-5 max-w-md mx-auto space-y-4">
        {/* 账号信息 */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
              {profile.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900 truncate">{profile.nickname}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-xs text-gray-400">{t('weight.label')}</p>
              <p className="text-sm font-semibold text-gray-800">{profile.weight_kg} kg</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-xs text-gray-400">{t('profile.goalWeight')}</p>
              <p className="text-sm font-semibold text-gray-800">{profile.target_weight_kg} kg</p>
            </div>
          </div>
        </Card>

        {/* 数据导出 */}
        <Card>
          <p className="text-sm font-semibold text-gray-800 mb-1">{t('profile.yourData')}</p>
          <p className="text-xs text-gray-400 leading-relaxed mb-3">{t('profile.exportDesc')}</p>
          <Button variant="outline" fullWidth loading={exporting} onClick={handleExport}>
            {t('profile.exportBtn')}
          </Button>
          {msg && <p className="text-xs text-primary-600 text-center mt-2">{msg}</p>}
        </Card>

        <Button variant="ghost" fullWidth onClick={signOut} className="text-gray-400 text-sm">
          {t('common.logout')}
        </Button>
      </div>
    </div>
  )
}
