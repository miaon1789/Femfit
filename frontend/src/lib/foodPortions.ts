/** Conversion is explicit: never assume that grams, millilitres and household portions are interchangeable. */
export function portionFactor(quantity: number, unit: string, baseQuantity: number, baseUnit: string, unitsPerPortion?: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(baseQuantity) || baseQuantity <= 0) return null
  if (unit === baseUnit) return quantity / baseQuantity
  if (!Number.isFinite(unitsPerPortion) || unitsPerPortion! <= 0) return null
  return quantity * unitsPerPortion! / baseQuantity
}
