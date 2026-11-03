import { test, expect } from '@playwright/test'
import { idA, idB, token, mockAPI, login } from './fixtures'

test('account switching clears the old profile and private response cache', async ({ page, context }) => {
  const api = await mockAPI(context)
  await login(page)
  await page.evaluate(async () => {
    const cache = await caches.open('supabase-cache')
    await cache.put('/synthetic-private', new Response('synthetic health data'))
  })
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/auth')
  expect(await page.evaluate(() => caches.has('supabase-cache'))).toBe(false)
  await login(page, 'b')
  expect(api.profiles).toContain(idB)
  await expect(page.getByText('Hi, Demo A 👋')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hi, Demo B 👋' })).toBeVisible()
})

test('meal read failures show retry and never pretend the daily total is zero', async ({ page, context }) => {
  const api = await mockAPI(context)
  api.mealFailure = true
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Could not load your meals')
  await page.goto('/records/food')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  await expect(page.getByTestId('daily-calories')).not.toContainText('0kcal eaten')
  api.mealFailure = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByTestId('daily-calories')).toHaveText('0kcal eaten')
})

test('a recovery link opens the password form, validates input and saves the new password', async ({ page, context }) => {
  const api = await mockAPI(context)
  await page.goto(`/reset-password#access_token=${token(idA)}&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  // Auth-js reconfirms the same session with SIGNED_IN when focus returns.
  await page.evaluate(async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    window.dispatchEvent(new Event('visibilitychange'))
    await new Promise(resolve => setTimeout(resolve, 0))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    window.dispatchEvent(new Event('visibilitychange'))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill('short')
  await page.getByLabel('Confirm password', { exact: true }).fill('short')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('alert')).toHaveText('Password must be at least 8 characters')
  expect(api.passwords).toEqual([])
  await page.getByLabel('New password', { exact: true }).fill('new-synthetic-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('different-password')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('alert')).toHaveText("The two passwords don't match")
  await page.getByLabel('Confirm password', { exact: true }).fill('new-synthetic-password')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('status')).toHaveText('Your password has been updated.')
  expect(api.passwords).toEqual(['new-synthetic-password'])
})

test('an expired recovery link cannot submit a new password', async ({ page, context }) => {
  const api = await mockAPI(context)
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired')
  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0)
  expect(api.passwords).toEqual([])
})

test('an expired recovery link cannot change the password of an already signed-in account', async ({ page, context }) => {
  const api = await mockAPI(context)
  await login(page, 'b')
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired')
  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0)
  expect(api.passwords).toEqual([])
})

test('a recovery error added on the same page hides an existing recovery form', async ({ page, context }) => {
  const api = await mockAPI(context)
  await page.goto(`/reset-password#access_token=${token(idA)}&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  await page.evaluate(() => { window.location.hash = 'error=access_denied&error_code=otp_expired' })
  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0)
  expect(api.passwords).toEqual([])
})

test.describe('production service worker', () => {
  test.use({ serviceWorkers: 'allow' })
  test('removes legacy private responses and never caches a new Supabase response', async ({ page, context }) => {
    await mockAPI(context)
    // Seed the previous cache before loading a page that registers the worker.
    await page.goto('/clear-private-cache.js')
    await page.evaluate(async () => {
      const cache = await caches.open('supabase-cache')
      await cache.put('/synthetic-private', new Response('old synthetic data'))
    })
    await page.goto('/auth')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      })
    })
    expect(await page.evaluate(() => caches.has('supabase-cache'))).toBe(false)
    await page.evaluate(async () => {
      const response = await fetch('https://femfit-smoke.supabase.co/rest/v1/synthetic-health')
      if (!response.ok) throw new Error('Synthetic response failed')
      await response.text()
    })
    const privateMatches = await page.evaluate(async () => {
      const keys = await caches.keys()
      const requests = (await Promise.all(keys.map(async key => (await caches.open(key)).keys()))).flat()
      return requests.filter(request => request.url.includes('supabase.co')).length
    })
    expect(privateMatches).toBe(0)
  })
})
