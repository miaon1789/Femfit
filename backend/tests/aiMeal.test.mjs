import { test } from 'node:test'
import assert from 'node:assert/strict'
import { InvalidAIResponse, parseAIJson, parseMealResult } from '../dist/lib/aiMeal.js'

const food = { food_name: 'Rice', quantity: 1, unit: 'bowl', calories: 200,
  protein_g: 4, carbs_g: 44, fat_g: 1, fiber_g: 0, iron_mg: 0 }
const meal = { foods: [food], total_calories: 999, cycle_tip: '' }

for (const [name, wrap] of [
  ['plain JSON', text => text],
  ['Markdown fence', text => '```json\n' + text + '\n```'],
  ['unlabelled fence', text => '```\n' + text + '\n```'],
  ['surrounding prose', text => 'Here is the estimate:\n' + text + '\nHope this helps.'],
  ['trailing prose', text => text + '\nHope this helps.'],
]) {
  test(`parses ${name} and replaces the model total`, () => {
    const result = parseMealResult(wrap(JSON.stringify(meal)))
    assert.deepEqual(result.foods, [food])
    assert.equal(result.total_calories, 200)
  })
}

for (const text of ['not JSON', '{"foods": [}', '```json\n{"foods":\n```']) {
  test(`rejects malformed JSON: ${text}`, () => {
    assert.throws(() => parseAIJson(text), InvalidAIResponse)
  })
}

for (const [name, value] of [
  ['missing fields', { foods: [{}], total_calories: 0, cycle_tip: '' }],
  ['numeric strings', { ...meal, foods: [{ ...food, calories: '200' }] }],
  ['negative calories', { ...meal, foods: [{ ...food, calories: -1 }] }],
  ['negative nutrients', { ...meal, foods: [{ ...food, protein_g: -1 }] }],
  ['zero quantity', { ...meal, foods: [{ ...food, quantity: 0 }] }],
  ['blank names', { ...meal, foods: [{ ...food, food_name: '  ' }] }],
  ['missing tip', { foods: [food], total_calories: 200 }],
  ['null', null],
  ['array', []],
  ['non-finite number', { ...meal, foods: [{ ...food, calories: null }] }],
  ['invalid total', { ...meal, total_calories: '999' }],
]) {
  test(`rejects structurally invalid JSON: ${name}`, () => {
    assert.throws(() => parseMealResult(JSON.stringify(value)), InvalidAIResponse)
  })
}

test('rejects an overflowing calorie sum and non-finite JSON numbers', () => {
  assert.throws(() => parseMealResult(JSON.stringify({ ...meal,
    foods: [{ ...food, calories: Number.MAX_VALUE }, { ...food, calories: Number.MAX_VALUE }],
  })), InvalidAIResponse)
  assert.throws(() => parseMealResult(JSON.stringify(meal).replace('200', '1e999')), InvalidAIResponse)
})

test('sums multiple foods and rounds only the final total', () => {
  const result = parseMealResult(JSON.stringify({ ...meal,
    foods: [{ ...food, calories: 0.1 }, { ...food, calories: 0.2 }],
  }))
  assert.equal(result.total_calories, 0.3)
})

test('allows a no-food result and zero nutrients, stripping unknown keys', () => {
  assert.deepEqual(parseMealResult(JSON.stringify({ foods: [], total_calories: 500,
    cycle_tip: '', unexpected: 'ignore' })), { foods: [], total_calories: 0, cycle_tip: '' })
})
