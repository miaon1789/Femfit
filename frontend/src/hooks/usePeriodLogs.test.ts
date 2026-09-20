import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePeriodLogs } from './usePeriodLogs'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), setProfile: vi.fn(), logs: [] as Array<{ start_date: string }>,
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, (value: unknown) => {
    if (Array.isArray(initial) && typeof value === 'function') mocks.logs = value(mocks.logs)
  }],
  useEffect: vi.fn(), useCallback: (fn: unknown) => fn,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u' } }) }))
vi.mock('@/store/userStore', () => ({ useUserStore: () => ({ setProfile: mocks.setProfile }) }))

function setup(startDate: string, profile: unknown, error: unknown = null) {
  const insert = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { start_date: startDate }, error: null }) }
  const update = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error }) }
  mocks.from.mockImplementation((table: string) => table === 'period_logs' ? insert : update)
  return update
}

beforeEach(() => { vi.clearAllMocks(); mocks.logs = [] })
describe('period start synchronization', () => {
  it('guards the stored date even when the local list has not loaded', async () => {
    const update = setup('2026-01-01', null)
    await usePeriodLogs().addPeriod({ start_date: '2026-01-01' })
    expect(update.or).toHaveBeenCalledWith('last_period_date.is.null,last_period_date.lt.2026-01-01')
    expect(mocks.setProfile).not.toHaveBeenCalled()
  })
  it('keeps a backfilled period behind the latest log', async () => {
    mocks.logs = [{ start_date: '2026-02-01' }]
    setup('2026-01-01', null)
    await usePeriodLogs().addPeriod({ start_date: '2026-01-01' })
    expect(mocks.logs.map(l => l.start_date)).toEqual(['2026-02-01', '2026-01-01'])
  })
  it('publishes the updated profile before save resolves', async () => {
    const profile = { id: 'u', last_period_date: '2026-03-01' }
    setup('2026-03-01', profile)
    await usePeriodLogs().addPeriod({ start_date: '2026-03-01' })
    expect(mocks.setProfile).toHaveBeenCalledWith(profile)
  })
  it('surfaces profile sync failure instead of reporting success', async () => {
    const error = new Error('profile update failed')
    setup('2026-03-01', null, error)
    await expect(usePeriodLogs().addPeriod({ start_date: '2026-03-01' })).rejects.toThrow(error)
    expect(mocks.logs).toEqual([{ start_date: '2026-03-01' }])
  })
})
