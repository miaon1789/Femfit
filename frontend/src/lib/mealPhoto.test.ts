import { afterEach, expect, it, vi } from 'vitest'
import { MAX_SOURCE_PHOTO_BYTES, prepareMealPhoto, photoDimensions } from './mealPhoto'

afterEach(() => vi.unstubAllGlobals())
it('resizes portrait and landscape photos without upscaling', () => {
  expect(photoDimensions(4000, 3000)).toEqual({ width: 1536, height: 1152 })
  expect(photoDimensions(3000, 4000)).toEqual({ width: 1152, height: 1536 })
  expect(photoDimensions(800, 600)).toEqual({ width: 800, height: 600 })
})
it('rejects unsupported and oversized source files before allocating an image', async () => {
  const create = vi.fn()
  vi.stubGlobal('Image', create)
  await expect(prepareMealPhoto({ type: 'image/svg+xml', size: 20 } as File)).rejects.toThrow('food.photoUnsupported')
  await expect(prepareMealPhoto({ type: 'image/jpeg', size: MAX_SOURCE_PHOTO_BYTES + 1 } as File)).rejects.toThrow('food.photoTooLarge')
  await expect(prepareMealPhoto({ type: 'image/jpeg', size: 0 } as File)).rejects.toThrow('food.photoTooLarge')
  expect(create).not.toHaveBeenCalled()
})
