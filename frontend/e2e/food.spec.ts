import type { Page } from '@playwright/test'
import { test, expect, login, readFoods } from './fixtures'
import { testEnvironment } from './environment'

async function enterFood(page: Page, meal: 'Breakfast' | 'Lunch', name: string, calories: number) {
  await page.getByRole('button', { name: `Add to ${meal}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: `Add to ${meal}` })
  await dialog.getByLabel('Food name', { exact: true }).fill(name)
  await dialog.getByLabel('Quantity', { exact: true }).fill('150')
  await dialog.getByLabel('Calories', { exact: true }).fill(String(calories))
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  return dialog
}
async function totals(page: Page, breakfast: number, lunch: number, daily: number) {
  await expect(page.getByTestId('daily-calories')).toHaveText(`${daily}kcal eaten`)
  for (const [meal, value] of [['breakfast', breakfast], ['lunch', lunch]] as const) {
    const total = page.getByTestId(`meal-${meal}`).getByTestId('meal-calories')
    if (value === 0) await expect(total).toHaveCount(0)
    else await expect(total).toHaveText(`${value} kcal`)
  }
}

test('two meal entries update the right meal and daily total and persist after refresh', async ({ page, account }) => {
  await login(page, account)
  await page.goto('/records/food')
  await totals(page, 0, 0, 0)
  await expect(await enterFood(page, 'Breakfast', 'E2E oats', 200)).toBeHidden()
  await expect(await enterFood(page, 'Lunch', 'E2E rice', 174)).toBeHidden()
  await totals(page, 200, 174, 374)
  await expect(page.getByTestId('meal-lunch')).toContainText('E2E rice')
  await expect(page.getByTestId('meal-breakfast')).not.toContainText('E2E rice')
  await page.reload()
  await totals(page, 200, 174, 374)
  expect(await readFoods(account)).toEqual(expect.arrayContaining([
    expect.objectContaining({ food_name: 'E2E rice', quantity: 150, calories: 174, meal_type: 'lunch' }),
    expect.objectContaining({ food_name: 'E2E oats', calories: 200, meal_type: 'breakfast' }),
  ]))
})

test('deleting a saved entry updates totals and stays deleted after refresh', async ({ page, account }) => {
  await login(page, account)
  await page.goto('/records/food')
  await expect(await enterFood(page, 'Breakfast', 'Keep oats', 200)).toBeHidden()
  await expect(await enterFood(page, 'Lunch', 'Delete rice', 174)).toBeHidden()
  const lunch = page.getByTestId('meal-lunch')
  await lunch.getByRole('button', { name: 'Delete Delete rice', exact: true }).click()
  await lunch.getByRole('button', { name: 'Confirm delete', exact: true }).click()
  await expect(lunch.getByText('Delete rice', { exact: true })).toHaveCount(0)
  await totals(page, 200, 0, 200)
  await page.reload()
  await totals(page, 200, 0, 200)
  expect((await readFoods(account)).map(f => f.food_name)).toEqual(['Keep oats'])
})

test('failed save displays an error without increasing totals, and can be retried', async ({ page, account }) => {
  await login(page, account)
  await page.goto('/records/food')
  await expect(await enterFood(page, 'Breakfast', 'Existing oats', 200)).toBeHidden()
  const writes = `${testEnvironment().url}/rest/v1/food_entries*`
  // Fault injection only for this write. Auth, reads and the retry hit real Supabase.
  await page.route(writes, route => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Injected write failure"}' })
    : route.continue())
  const dialog = await enterFood(page, 'Lunch', 'Retry rice', 174)
  await expect(dialog.getByRole('alert')).toHaveText('Failed to save, please try again')
  await expect(dialog).toBeVisible()
  await totals(page, 200, 0, 200)
  expect((await readFoods(account)).map(f => f.food_name)).toEqual(['Existing oats'])
  await page.reload()
  await totals(page, 200, 0, 200)
  await page.unroute(writes)
  await expect(await enterFood(page, 'Lunch', 'Retry rice', 174)).toBeHidden()
  await totals(page, 200, 174, 374)
  await page.reload()
  await totals(page, 200, 174, 374)
  expect((await readFoods(account)).filter(f => f.food_name === 'Retry rice')).toHaveLength(1)
})
