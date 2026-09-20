import { describe, expect, it } from 'vitest'
import { portionFactor } from './foodPortions'

describe('food portion conversion', () => {
  it('scales grams and fractional portions', () => {
    expect(portionFactor(150, 'g', 100, 'g')).toBe(1.5)
    expect(portionFactor(0.5, '碗', 1, '碗')).toBe(0.5)
  })
  it('requires an explicit conversion between units', () => {
    expect(portionFactor(1, '碗', 100, 'g')).toBeNull()
    expect(portionFactor(100, 'ml', 100, 'g')).toBeNull()
    expect(portionFactor(1, '碗', 100, 'g', 150)).toBe(1.5)
    expect(portionFactor(0.5, '杯', 100, 'ml', 250)).toBe(1.25)
  })
  it('rejects nonfinite, zero and negative amounts', () => {
    for (const n of [NaN, Infinity, 0, -1]) {
      expect(portionFactor(n, 'g', 100, 'g')).toBeNull()
      expect(portionFactor(100, 'g', n, 'g')).toBeNull()
      expect(portionFactor(1, '碗', 100, 'g', n)).toBeNull()
    }
  })
})
