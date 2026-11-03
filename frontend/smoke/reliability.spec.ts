import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const idA = '00000000-0000-0000-0000-000000000001'
const idB = '00000000-0000-0000-0000-000000000002'
const user = (id: string) => ({ id, aud: 'authenticated', role: 'authenticated',
  email: `${id === idA ? 'a' : 'b'}@example.test`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
const token = (id: string) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'synthetic-signature',
].join('.')

async function mockAPI(context: BrowserContext) {
  const state = { current: idA, mealFailure: false, passwords: [] as string[], profiles: [] as string[] }
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:4174') return route.continue()
    if (url.origin !== 'https://femfit-smoke.supabase.co') return route.abort('blockedbyclient')
    let body: unknown = []
    let status = 200
    if (url.pathname === '/auth/v1/token') {
      state.current = request.postDataJSON().email.startsWith('b@') ? idB : idA
      body = { access_token: token(state.current), refresh_token: 'synthetic-refresh',
        expires_in: 3600, token_type: 'bearer', user: user(state.current) }
    } else if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') state.passwords.push(request.postDataJSON().password)
      body = user(state.current)
    } else if (url.pathname === '/auth/v1/logout') body = {}
    else if (url.pathname === '/rest/v1/users') {
      const id = url.searchParams.get('id')?.replace('eq.', '') ?? state.current
      state.profiles.push(id)
      body = { id, nickname: id === idA ? 'Demo A' : 'Demo B', email: user(id).email,
        onboarding_completed: true, birth_year: 1995, birth_month: 1,
        height_cm: 170, weight_kg: 65, target_weight_kg: 60, activity_level: 'sedentary',
        weight_goal_pace: 'slow', last_period_date: null, avg_cycle_days: 28, avg_period_days: 5 }
    } else if (url.pathname === '/rest/v1/meal_logs' && state.mealFailure) {
      status = 500; body = { message: 'Injected meal read failure', code: 'MOCK' }
    } else if (url.pathname === '/rest/v1/weight_logs') body = null
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body),
      headers: { 'access-control-allow-origin': '*' } })
  })
  return state
}
async function login(page: Page, account = 'a') {
  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill(`${account}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Hi, Demo ${account.toUpperCase()} 👋` })).toBeVisible()
}

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
