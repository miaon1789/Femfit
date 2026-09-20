import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOFF, normalizeUSDA } from '../dist/lib/externalFoods.js'

test('OFF converts kJ to kcal and rejects missing energy', () => {
  assert.equal(normalizeOFF({ code: '12345678', product_name: 'Test', nutriments: { energy_100g: 418.4 } }).calories, 100)
  assert.equal(normalizeOFF({ code: '12345678', product_name: 'Test', nutriments: {} }), null)
  assert.equal(normalizeOFF({ code: '12345678', product_name: 'Test', nutriments: { 'energy-kcal_100g': null } }), null)
})
test('OFF keeps genuine zero-energy food', () => {
  assert.equal(normalizeOFF({ code: '12345678', product_name: 'Water', nutriments: { 'energy-kcal_100g': 0 } }).calories, 0)
})
test('USDA chooses kcal energy and maps nutrient IDs and units', () => {
  const food = normalizeUSDA({ fdcId: 12, description: 'Rice', foodNutrients: [
    { nutrientId: 1062, unitName: 'kJ', value: 418 },
    { nutrientId: 1008, unitName: 'KCAL', value: 100 },
    { nutrientId: 1003, unitName: 'G', value: 4 },
  ] })
  assert.equal(food.calories, 100)
  assert.equal(food.protein_g, 4)
  assert.equal(food.serving_size, 100)
  assert.equal(normalizeUSDA({ fdcId: 12, description: 'Rice', foodNutrients: [] }), null)
})
