import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLatestWeightLog } from './useLatestWeightLog'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), setResult: vi.fn(), user: { id: 'user-a' } as { id: string } | null,
  effects: [] as Array<() => (() => void) | undefined>,
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, mocks.setResult],
  useEffect: (effect: () => (() => void) | undefined) => { mocks.effects.push(effect) },
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: mocks.user }) }))

function query(data: unknown, error: unknown = null) {
  const result = {
    select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  for (const method of ['select', 'eq', 'lte', 'order', 'limit'] as const) result[method].mockReturnValue(result)
  return result
}
beforeEach(() => {
  mocks.from.mockReset(); mocks.setResult.mockReset(); mocks.effects = []; mocks.user = { id: 'user-a' }
})
describe('latest recorded weight', () => {
  it('loads the most recent non-future record without a seven-day cutoff', async () => {
    const log = { id: 'old-log', date: '2026-08-06', weight_kg: 54.6 }
    const request = query(log)
    mocks.from.mockReturnValue(request)
    useLatestWeightLog(); mocks.effects[0]()
    await vi.waitFor(() => expect(mocks.setResult).toHaveBeenLastCalledWith({
      userId: 'user-a', log, loading: false, error: null,
    }))
    expect(request.eq).toHaveBeenCalledWith('user_id', 'user-a')
    expect(request.lte).toHaveBeenCalledWith('date', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(request.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(request.limit).toHaveBeenCalledWith(1)
  })
  it('returns no log for an account without history', async () => {
    mocks.from.mockReturnValue(query(null))
    useLatestWeightLog(); mocks.effects[0]()
    await vi.waitFor(() => expect(mocks.setResult).toHaveBeenLastCalledWith({
      userId: 'user-a', log: null, loading: false, error: null,
    }))
  })
  it('does not publish a response after the consumer unmounts or changes user', async () => {
    const request = query({ weight_kg: 54.6 })
    mocks.from.mockReturnValue(request)
    useLatestWeightLog(); const cleanup = mocks.effects[0]()
    cleanup?.()
    await request.maybeSingle.mock.results[0].value
    expect(mocks.setResult).toHaveBeenCalledTimes(1)
  })
  it('keeps a failed query distinct from an empty history', async () => {
    mocks.from.mockReturnValue(query(null, { message: 'network error' }))
    useLatestWeightLog(); mocks.effects[0]()
    await vi.waitFor(() => expect(mocks.setResult).toHaveBeenLastCalledWith({
      userId: 'user-a', log: null, loading: false, error: 'network error',
    }))
  })
})
