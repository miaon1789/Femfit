import { afterEach, expect, it, vi } from 'vitest'
import { clearPrivateApiCache } from './privateCache'

afterEach(() => vi.unstubAllGlobals())
it('deletes only the legacy private-response cache', async () => {
  const remove = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('caches', { delete: remove })
  await clearPrivateApiCache()
  expect(remove).toHaveBeenCalledTimes(1)
  expect(remove).toHaveBeenCalledWith('supabase-cache')
})
it('works when CacheStorage is unavailable', async () => {
  vi.stubGlobal('caches', undefined)
  await expect(clearPrivateApiCache()).resolves.toBeUndefined()
})
