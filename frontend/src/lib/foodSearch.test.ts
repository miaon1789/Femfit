import { describe, expect, it, vi } from 'vitest'
import { searchFoodDatabase } from './foodSearch'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
describe('food search', () => {
  it('passes punctuation as a value, never as PostgREST filter syntax', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await searchFoodDatabase('  fish, chips (fried)  ')
    expect(rpc).toHaveBeenLastCalledWith('search_foods', { search_query: 'fish, chips (fried)', result_limit: 30 })
  })
  it('keeps a failed query distinct from an empty result', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('offline') })
    await expect(searchFoodDatabase('米饭')).rejects.toThrow('offline')
  })
})
