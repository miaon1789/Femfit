import { expect, type BrowserContext, type Page } from '@playwright/test'

export const idA = '00000000-0000-0000-0000-000000000001'
export const idB = '00000000-0000-0000-0000-000000000002'
const user = (id: string) => ({ id, aud: 'authenticated', role: 'authenticated',
  email: `${id === idA ? 'a' : 'b'}@example.test`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
export const token = (id: string) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'synthetic-signature',
].join('.')

export async function mockAPI(context: BrowserContext) {
  type MealRequest = { description: string; image?: { media_type: string; data: string }; meal_type: string }
  type Entry = { id: string; meal_log_id: string; food_name: string; calories: number }
  type Meal = { id: string; user_id: string; date: string; meal_type: string; food_entries: Entry[] }
  const state = { current: idA, mealFailure: false, passwords: [] as string[], profiles: [] as string[],
    analyses: [] as MealRequest[], analysisFailure: '', meals: [] as Meal[],
    analysisResult: { foods: [
      { food_name: 'Rice', quantity: 150, unit: 'g', calories: 200, protein_g: 4, carbs_g: 44, fat_g: 1, fiber_g: 1, iron_mg: 0.5 },
      { food_name: 'Chicken', quantity: 120, unit: 'g', calories: 250, protein_g: 30, carbs_g: 0, fat_g: 14, fiber_g: 0, iron_mg: 1 },
    ], total_calories: 450, cycle_tip: '', report_id: 'synthetic-report' },
  }
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:4174' && url.pathname === '/synthetic-api/api/ai/analyze-meal') {
      state.analyses.push(request.postDataJSON())
      return route.fulfill({ status: state.analysisFailure ? 429 : 200, contentType: 'application/json',
        body: JSON.stringify(state.analysisFailure ? { error: state.analysisFailure } : state.analysisResult) })
    }
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
    } else if (url.pathname === '/rest/v1/meal_logs') {
      if (state.mealFailure) { status = 500; body = { message: 'Injected meal read failure', code: 'MOCK' } }
      else if (request.method() === 'POST') {
        const meal = { ...request.postDataJSON(), id: `meal-${state.meals.length + 1}`, food_entries: [] }
        state.meals.push(meal); body = meal
      } else {
        const matches = state.meals.filter(meal => meal.user_id === state.current
          && (!url.searchParams.has('meal_type') || `eq.${meal.meal_type}` === url.searchParams.get('meal_type')))
        body = url.searchParams.has('meal_type') ? matches[0] ?? null : matches
      }
    } else if (url.pathname === '/rest/v1/food_entries' && request.method() === 'POST') {
      const entries = request.postDataJSON().map((entry: Entry, index: number) => ({ ...entry, id: `food-${index + 1}` }))
      for (const entry of entries) state.meals.find(meal => meal.id === entry.meal_log_id)?.food_entries.push(entry)
      body = entries
    } else if (url.pathname === '/rest/v1/weight_logs') body = null
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body),
      headers: { 'access-control-allow-origin': '*' } })
  })
  return state
}
export async function login(page: Page, account = 'a') {
  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill(`${account}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Hi, Demo ${account.toUpperCase()} 👋` })).toBeVisible()
}

