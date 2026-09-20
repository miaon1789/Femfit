import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFoodLogs } from './useFoodLogs'
import type { MealLogWithEntries } from './useFoodLogs'
const mocks = vi.hoisted(() => ({ from: vi.fn(), meals: [] as MealLogWithEntries[] }))
vi.mock('react', () => ({
  useState: (initial: unknown) => [Array.isArray(initial) ? mocks.meals : initial, (value: unknown) => {
    if (Array.isArray(initial) && typeof value === 'function') mocks.meals = value(mocks.meals)
  }], useEffect: vi.fn(), useCallback: (fn: unknown) => fn,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u' } }) }))
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
beforeEach(() => { mocks.from.mockReset(); mocks.meals = [] })
describe('meal batch saving and reuse', () => {
  it('saves all foods in a single batch under one meal', async () => {
    const entries = query(foods)
    mocks.from.mockReturnValueOnce(query(null)).mockReturnValueOnce(query(meal)).mockReturnValueOnce(entries)
    await useFoodLogs('2026-01-06').addFoodEntries('lunch', foods)
    expect(entries.insert.mock.calls[0][0]).toHaveLength(2)
    expect(entries.insert.mock.calls[0][0].every((f: { meal_log_id: string }) => f.meal_log_id === 'm')).toBe(true)
    expect(mocks.meals).toHaveLength(1)
    expect(mocks.meals[0].food_entries).toHaveLength(2)
  })
  it('does not publish partial local entries when the batch fails', async () => {
    mocks.from.mockReturnValueOnce(query(meal)).mockReturnValueOnce(query(null, new Error('write failed')))
    await expect(useFoodLogs('2026-01-06').addFoodEntries('lunch', foods)).rejects.toThrow('write failed')
    expect(mocks.meals).toEqual([])
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
