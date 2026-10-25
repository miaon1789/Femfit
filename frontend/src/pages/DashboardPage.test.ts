import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { WeightStats } from '@/components/weight/WeightStats'
import type { WeightLog } from '@/types'

const state = vi.hoisted(() => ({
  log: { id: 'w', user_id: 'u', date: '2026-08-06', weight_kg: 54.6, created_at: '' } as WeightLog | null,
  profile: { nickname: 'Demo', weight_kg: 57.6, height_cm: 175, target_weight_kg: 55,
    last_period_date: '2026-10-25', avg_cycle_days: 30, avg_period_days: 5 },
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string) => key, i18n: { language: 'en' },
}) }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u' }, signOut: vi.fn() }) }))
vi.mock('@/store/userStore', () => ({ useUserStore: () => ({ profile: state.profile, loading: false, fetchProfile: vi.fn() }) }))
vi.mock('@/hooks/useLatestWeightLog', () => ({ useLatestWeightLog: () => ({ log: state.log }) }))
vi.mock('@/hooks/useExerciseLogs', () => ({ useExerciseLogs: () => ({ logs: [] }), WORKOUT_TYPE_META: {} }))
vi.mock('@/hooks/useCalorieTarget', () => ({ useCalorieTarget: () => null }))
vi.mock('@/hooks/useFoodLogs', () => ({ useFoodLogs: () => ({ totalCalories: 0 }) }))
vi.mock('@/components/ui/LanguageToggle', () => ({ LanguageToggle: () => null }))
afterEach(() => { state.log = { id: 'w', user_id: 'u', date: '2026-08-06', weight_kg: 54.6, created_at: '' } })
describe('dashboard recorded weight', () => {
  it('matches the weight page for an older log rather than using the initial profile weight', () => {
    const dashboard = renderToStaticMarkup(createElement(DashboardPage))
    const records = renderToStaticMarkup(createElement(WeightStats, {
      logs: [state.log!], targetWeight: 55, heightCm: 175,
    }))
    for (const html of [dashboard, records]) {
      expect(html).toContain('54.6')
      expect(html).toContain('17.8')
      expect(html).not.toContain('57.6')
    }
    expect(dashboard).toContain('dashboard.goalReached')
    expect(records).toContain('weight.reached')
  })
  it('uses profile weight when no weight has ever been logged', () => {
    state.log = null
    const html = renderToStaticMarkup(createElement(DashboardPage))
    expect(html).toContain('57.6')
    expect(html).toContain('18.8')
  })
})
