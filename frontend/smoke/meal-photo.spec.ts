import { test, expect, type Page } from '@playwright/test'
import { login, mockAPI } from './fixtures'

async function fixturePhoto(page: Page, color = '#8bb56b') {
  const data = await page.evaluate(fill => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400; canvas.height = 1600
    const context = canvas.getContext('2d')!
    context.fillStyle = '#efe5ce'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = fill; context.fillRect(400, 300, 1600, 1000)
    return canvas.toDataURL('image/png').split(',')[1]
  }, color)
  return { name: 'synthetic-meal.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }
}
async function openAnalysis(page: Page) {
  await page.goto('/records/food')
  const open = page.getByRole('button', { name: '📷 Estimate a meal with AI', exact: true })
  await expect(open).toBeEnabled()
  await open.click()
  return page.getByRole('dialog', { name: '✨ AI meal estimate' })
}

test('a photo and portion notes are sent together, then confirmed foods persist after refresh', async ({ page, context }) => {
  const api = await mockAPI(context)
  await login(page)
  const dialog = await openAnalysis(page)
  await dialog.getByTestId('meal-photo-input').setInputFiles(await fixturePhoto(page))
  const preview = dialog.getByAltText('Meal photo preview')
  await expect(preview).toBeVisible()
  expect(await preview.evaluate(image => ({ width: (image as HTMLImageElement).naturalWidth,
    height: (image as HTMLImageElement).naturalHeight }))).toEqual({ width: 1536, height: 1024 })
  await dialog.getByLabel('Add portion details (optional)').fill('I ate half. About one bowl of rice and chicken.')
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByText('450 kcal', { exact: true })).toBeVisible()
  expect(api.analyses).toHaveLength(1)
  expect(api.analyses[0].description).toContain('I ate half')
  expect(api.analyses[0].image?.media_type).toBe('image/jpeg')
  const bytes = Buffer.from(api.analyses[0].image!.data, 'base64')
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
  expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024)
  expect(api.meals).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Save all', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('daily-calories')).toHaveText('450kcal eaten')
  expect(api.meals[0].food_entries).toHaveLength(2)
  expect(JSON.stringify(api.meals)).not.toContain(api.analyses[0].image!.data)
  await page.reload()
  await expect(page.getByTestId('daily-calories')).toHaveText('450kcal eaten')
})

test('camera selection works without notes, and removing the photo restores text-only analysis', async ({ page, context }) => {
  const api = await mockAPI(context)
  await login(page)
  const dialog = await openAnalysis(page)
  await expect(dialog.getByTestId('meal-camera-input')).toHaveAttribute('capture', 'environment')
  await dialog.getByTestId('meal-camera-input').setInputFiles(await fixturePhoto(page))
  await expect(dialog.getByAltText('Meal photo preview')).toBeVisible()
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toBeEnabled()
  expect(api.analyses[0].description).toBe('')
  expect(api.analyses[0].image).toBeTruthy()
  await dialog.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await expect(dialog.getByAltText('Meal photo preview')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Add a meal photo or describe')
  expect(api.analyses).toHaveLength(1)
  await dialog.getByLabel('Add a photo or describe this meal').fill('A bowl of rice')
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toBeEnabled()
  expect(api.analyses[1].image).toBeUndefined()
})

test('replacing a photo or changing notes invalidates the previous estimate', async ({ page, context }) => {
  const api = await mockAPI(context)
  await login(page)
  const dialog = await openAnalysis(page)
  await dialog.getByTestId('meal-photo-input').setInputFiles(await fixturePhoto(page))
  await expect(dialog.getByAltText('Meal photo preview')).toBeVisible()
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toBeEnabled()
  await dialog.getByTestId('meal-photo-input').setInputFiles(await fixturePhoto(page, '#c68c5b'))
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toHaveCount(0)
  await expect(dialog.getByAltText('Meal photo preview')).toBeVisible()
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toBeEnabled()
  expect(api.analyses[1].image?.data).not.toBe(api.analyses[0].image?.data)
  await dialog.getByLabel('Add portion details (optional)').fill('I ate one third')
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toHaveCount(0)
  expect(api.meals).toHaveLength(0)
})

test('unsupported or unreadable files fail locally without spending an AI attempt', async ({ page, context }) => {
  const api = await mockAPI(context)
  await login(page)
  const dialog = await openAnalysis(page)
  await dialog.getByTestId('meal-photo-input').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(dialog.getByRole('alert')).toContainText('JPG, PNG or WebP')
  await dialog.getByTestId('meal-photo-input').setInputFiles({ name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('broken image') })
  await expect(dialog.getByRole('alert')).toContainText('Could not read this photo')
  expect(api.analyses).toHaveLength(0)
  await expect(dialog.getByAltText('Meal photo preview')).toHaveCount(0)
})

test('analysis failure preserves the photo for a retry', async ({ page, context }) => {
  const api = await mockAPI(context)
  api.analysisFailure = 'ai_daily_limit'
  await login(page)
  const dialog = await openAnalysis(page)
  await dialog.getByTestId('meal-photo-input').setInputFiles(await fixturePhoto(page))
  await expect(dialog.getByAltText('Meal photo preview')).toBeVisible()
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('3 free AI attempts')
  await expect(dialog.getByAltText('Meal photo preview')).toBeVisible()
  api.analysisFailure = ''
  await dialog.getByRole('button', { name: '✨ AI recognize', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save all', exact: true })).toBeEnabled()
  expect(api.analyses[1].image?.data).toBe(api.analyses[0].image?.data)
})
