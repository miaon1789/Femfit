import { randomUUID } from 'node:crypto'
import { test as base, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { testEnvironment } from './environment'

const env = testEnvironment()
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
type Account = { id: string; email: string; password: string }

export const test = base.extend<{ account: Account }>({
  account: async ({}, use, testInfo) => {
    const { data: marker, error: markerError } = await admin.from('e2e_test_environment').select('label').eq('id', true).single()
    if (markerError || marker?.label !== 'femfit-e2e-only') {
      throw new Error('Missing test-only database marker. No account was created. Run supabase/tests/e2e-environment.sql only in the separate test project after its schema and migrations.')
    }
    const suffix = randomUUID()
    const email = `femfit-e2e-${suffix}@example.com`
    const password = `E2e!${randomUUID()}`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { femfit_e2e: true, run: process.env.GITHUB_RUN_ID ?? 'local', test: testInfo.title } })
    if (error || !data.user) throw new Error(`Could not create isolated test account: ${error?.message}`)
    const id = data.user.id
    try {
      const { error: profileError } = await admin.from('users').update({ nickname: 'E2E User', birth_year: 1995,
        birth_month: 1, height_cm: 165, weight_kg: 60, target_weight_kg: 55, activity_level: 'moderate',
        weight_goal_pace: 'slow', last_period_date: '2026-01-01', avg_cycle_days: 28, avg_period_days: 5,
        onboarding_completed: true }).eq('id', id).select('id').single()
      if (profileError) throw new Error(`Test profile setup failed: ${profileError.message}`)
      await use({ id, email, password })
    } finally {
      // Delete only the exact account created by this fixture. Foreign keys cascade its records.
      const { error: cleanupError } = await admin.auth.admin.deleteUser(id)
      if (cleanupError) throw new Error(`Cleanup failed for test user ${id}: ${cleanupError.message}`)
    }
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('femfit-lang', 'en'))
    // No successful auth or database request is mocked. Unexpected external calls fail visibly.
    await page.route('**/e2e-external/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"External provider outside E2E scope"}' }))
    await use(page)
  },
})
export { expect }

export async function login(page: Page, account: Account) {
  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
}

// A normal authenticated client verifies persistence under RLS, not with the admin key.
export async function readFoods(account: Account) {
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword(account)
  if (error) throw error
  const result = await client.from('meal_logs').select('meal_type, food_entries(food_name,quantity,calories)')
  if (result.error) throw result.error
  return result.data.flatMap(meal => meal.food_entries.map(food => ({ ...food, meal_type: meal.meal_type })))
}
