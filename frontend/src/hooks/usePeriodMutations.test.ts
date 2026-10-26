import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePeriodLogs } from './usePeriodLogs'
import type { PeriodLog } from '@/types'
const mocks = vi.hoisted(() => ({ from: vi.fn(), setProfile: vi.fn(), logs: [] as PeriodLog[], error: null as unknown }))
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, (value: unknown) => {
    if (Array.isArray(initial) && typeof value === 'function') mocks.logs = value(mocks.logs)
    else if (initial === null) mocks.error = value
  }], useEffect: vi.fn(), useCallback: (fn: unknown) => fn,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u' } }) }))
vi.mock('@/store/userStore', () => ({ useUserStore: () => ({ setProfile: mocks.setProfile }) }))
const row = (id: string, start_date: string): PeriodLog => ({ id, user_id: 'u', start_date,
  end_date: null, flow_level: null, pain_level: null, notes: null, mood: null, created_at: '' })
function query(data: unknown, error: unknown = null) {
  const q = { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }) }
  mocks.from.mockReturnValueOnce(q)
  return q
}
beforeEach(() => { vi.clearAllMocks(); mocks.logs = []; mocks.error = null })
describe('period edit and delete', () => {
  it('reorders edited starts and synchronizes the dashboard from the full latest query', async () => {
    const old = row('a', '2026-03-01'); const updated = row('a', '2026-01-01')
    mocks.logs = [old, row('b', '2026-02-01')]
    const read = query(old); const write = query(updated)
    const latest = query({ start_date: '2026-02-01' })
    const profile = { id: 'u', last_period_date: '2026-02-01' }; const sync = query(profile)
    await usePeriodLogs().updatePeriod('a', { start_date: updated.start_date })
    expect(mocks.logs.map(log => log.id)).toEqual(['b', 'a'])
    expect(read.eq).toHaveBeenCalledWith('user_id', 'u')
    expect(write.eq).toHaveBeenCalledWith('user_id', 'u')
    expect(latest.limit).toHaveBeenCalledWith(1)
    expect(sync.update).toHaveBeenCalledWith({ last_period_date: '2026-02-01' })
    expect(sync.or).toHaveBeenCalledWith('last_period_date.is.null,last_period_date.eq.2026-03-01,last_period_date.lt.2026-02-01')
    expect(mocks.setProfile).toHaveBeenCalledWith(profile)
  })
  it('does not change the cycle start when only notes or the end date change', async () => {
    const old = row('a', '2026-03-01'); query(old); query({ ...old, notes: 'updated', end_date: '2026-03-05' })
    await usePeriodLogs().updatePeriod('a', { notes: 'updated', end_date: '2026-03-05' })
    expect(mocks.from).toHaveBeenCalledTimes(2)
    expect(mocks.setProfile).not.toHaveBeenCalled()
  })
  it('rejects an end date before the edited start without writing', async () => {
    query({ ...row('a', '2026-03-01'), end_date: '2026-03-05' })
    await expect(usePeriodLogs().updatePeriod('a', { start_date: '2026-03-06' })).rejects.toThrow('Invalid period dates')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
  it('removes the latest record and restores the previous start date', async () => {
    const old = row('a', '2026-03-01'); mocks.logs = [old, row('b', '2026-02-01')]
    const del = query(old); query({ start_date: '2026-02-01' }); const sync = query({ last_period_date: '2026-02-01' })
    await usePeriodLogs().deletePeriod('a')
    expect(del.delete).toHaveBeenCalledOnce()
    expect(del.eq).toHaveBeenCalledWith('id', 'a')
    expect(del.eq).toHaveBeenCalledWith('user_id', 'u')
    expect(mocks.logs.map(log => log.id)).toEqual(['b'])
    expect(sync.update).toHaveBeenCalledWith({ last_period_date: '2026-02-01' })
  })
  it('clears the cycle start after deleting the last record', async () => {
    const old = row('a', '2026-03-01'); mocks.logs = [old]
    query(old); query(null); const sync = query({ last_period_date: null })
    await usePeriodLogs().deletePeriod('a')
    expect(mocks.logs).toEqual([])
    expect(sync.update).toHaveBeenCalledWith({ last_period_date: null })
    expect(mocks.setProfile).toHaveBeenCalledWith({ last_period_date: null })
  })
  it('does not overwrite a newer independent profile date when the conditional update returns no row', async () => {
    query(row('a', '2026-01-01')); query({ start_date: '2025-12-01' }); const sync = query(null)
    await usePeriodLogs().deletePeriod('a')
    expect(sync.or).toHaveBeenCalledWith('last_period_date.is.null,last_period_date.eq.2026-01-01,last_period_date.lt.2025-12-01')
    expect(mocks.setProfile).not.toHaveBeenCalled()
  })
  it('keeps local history when deletion fails and does not sync the profile', async () => {
    const old = row('a', '2026-03-01'); mocks.logs = [old]
    query(null, new Error('not allowed'))
    await expect(usePeriodLogs().deletePeriod('a')).rejects.toThrow('not allowed')
    expect(mocks.logs).toEqual([old]); expect(mocks.from).toHaveBeenCalledTimes(1)
  })
  it('reports a separate sync warning after a successful deletion without asking for a second delete', async () => {
    const old = row('a', '2026-03-01'); mocks.logs = [old]
    query(old); query(null, new Error('network unavailable'))
    await usePeriodLogs().deletePeriod('a')
    expect(mocks.logs).toEqual([])
    expect(mocks.error).toBe('period.syncFailed')
  })
})
