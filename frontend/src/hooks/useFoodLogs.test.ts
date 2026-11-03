import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFoodLogs } from './useFoodLogs'
import type { MealLogWithEntries } from './useFoodLogs'
type Result = { key: string; meals: MealLogWithEntries[]; loading: boolean; error: string | null }
const mocks = vi.hoisted(() => ({
  from: vi.fn(), state: null as Result | null, request: { current: 0 },
  effects: [] as Array<() => (() => void) | undefined>, user: { id: 'u' } as { id: string } | null,
}))
vi.mock('react', () => ({
  useState: (initial: Result) => {
    mocks.state ??= initial
    return [mocks.state, (value: Result | ((prev: Result) => Result)) => {
      mocks.state = typeof value === 'function' ? value(mocks.state!) : value
    }]
  }, useEffect: (effect: () => (() => void) | undefined) => { mocks.effects.push(effect) },
  useCallback: (fn: unknown) => fn, useRef: () => mocks.request,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: mocks.user }) }))
function query(data: unknown, error: unknown = null) {
  const result = Object.assign(Promise.resolve({ data, error }), {
    select: vi.fn(), eq: vi.fn(), lt: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(), insert: vi.fn(),
  })
  for (const method of ['select', 'eq', 'lt', 'order', 'limit', 'maybeSingle', 'single', 'insert'] as const) result[method].mockReturnValue(result)
  return result
}
const meal = { id: 'm', meal_type: 'lunch', user_id: 'u', date: '2026-01-06', created_at: '' }
const foods = [
  { food_name: 'rice', quantity: 150, unit: 'g', calories: 174 },
  { food_name: 'egg', quantity: 1, unit: '个', calories: 72 },
]
beforeEach(() => { mocks.from.mockReset(); mocks.state = null; mocks.request.current = 0; mocks.effects = []; mocks.user = { id: 'u' } })
describe('meal batch saving and reuse', () => {
  it('saves all foods in a single batch under one meal', async () => {
    const entries = query(foods)
    mocks.from.mockReturnValueOnce(query(null)).mockReturnValueOnce(query(meal)).mockReturnValueOnce(entries)
    await useFoodLogs('2026-01-06').addFoodEntries('lunch', foods)
    expect(entries.insert.mock.calls[0][0]).toHaveLength(2)
    expect(entries.insert.mock.calls[0][0].every((f: { meal_log_id: string }) => f.meal_log_id === 'm')).toBe(true)
    expect(mocks.state!.meals).toHaveLength(1)
    expect(mocks.state!.meals[0].food_entries).toHaveLength(2)
  })
  it('does not publish partial local entries when the batch fails', async () => {
    mocks.from.mockReturnValueOnce(query(meal)).mockReturnValueOnce(query(null, new Error('write failed')))
    await expect(useFoodLogs('2026-01-06').addFoodEntries('lunch', foods)).rejects.toThrow('write failed')
    expect(mocks.state!.meals).toEqual([])
  })
  it('copies only a previous matching meal and preserves its portions', async () => {
    const previous = query({ food_entries: foods })
    const entries = query(foods)
    mocks.from.mockReturnValueOnce(previous).mockReturnValueOnce(query(meal)).mockReturnValueOnce(entries)
    expect(await useFoodLogs('2026-01-06').copyPreviousMeal('lunch')).toBe(true)
    expect(previous.lt).toHaveBeenCalledWith('date', '2026-01-06')
    expect(previous.eq).toHaveBeenCalledWith('meal_type', 'lunch')
    expect(entries.insert.mock.calls[0][0][0]).toMatchObject(foods[0])
  })
  it('reports an empty history without making any writes', async () => {
    mocks.from.mockReturnValueOnce(query(null))
    expect(await useFoodLogs('2026-01-06').copyPreviousMeal('lunch')).toBe(false)
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})

describe('meal reads', () => {
  it('distinguishes a failed read from an empty day and supports retry', async () => {
    mocks.from.mockReturnValueOnce(query(null, new Error('offline'))).mockReturnValueOnce(query([]))
    const hook = useFoodLogs('2026-01-06')
    await hook.refetch()
    expect(useFoodLogs('2026-01-06').error).toBe('food.loadFailed')
    expect(useFoodLogs('2026-01-06').loading).toBe(false)
    await hook.refetch()
    expect(useFoodLogs('2026-01-06').error).toBeNull()
    expect(useFoodLogs('2026-01-06').totalCalories).toBe(0)
  })

  it('does not publish an old read after the selected date changes', async () => {
    let finish!: (value: unknown) => void
    const old = new Promise(resolve => { finish = resolve })
    const builder = { select: vi.fn(), eq: vi.fn(), order: () => old }
    builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder)
    mocks.from.mockReturnValueOnce(builder).mockReturnValueOnce(query([]))
    const previous = useFoodLogs('2026-01-06').refetch()
    await useFoodLogs('2026-01-07').refetch()
    finish({ data: [{ ...meal, food_entries: foods }], error: null })
    await previous
    expect(useFoodLogs('2026-01-07').meals).toEqual([])
    expect(mocks.state!.key).toBe('u:2026-01-07')
  })

  it('hides the old account immediately and clears data on sign-out', async () => {
    mocks.from.mockReturnValue(query([{ ...meal, food_entries: foods }]))
    await useFoodLogs('2026-01-06').refetch()
    expect(useFoodLogs('2026-01-06').meals).toHaveLength(1)
    mocks.user = { id: 'other' }
    expect(useFoodLogs('2026-01-06').meals).toEqual([])
    mocks.user = null
    await useFoodLogs('2026-01-06').refetch()
    expect(useFoodLogs('2026-01-06').meals).toEqual([])
    expect(useFoodLogs('2026-01-06').loading).toBe(false)
  })

  it('invalidates pending reads when the consumer unmounts', async () => {
    mocks.from.mockReturnValue(query([{ ...meal, food_entries: foods }]))
    useFoodLogs('2026-01-06')
    const cleanup = mocks.effects[0]()
    cleanup?.()
    await vi.waitFor(() => expect(mocks.from).toHaveBeenCalled())
    expect(mocks.state!.meals).toEqual([])
  })
})
