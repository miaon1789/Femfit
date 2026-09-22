import { defineConfig, devices } from '@playwright/test'
import { testEnvironment } from './e2e/environment'

const env = testEnvironment()
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-AU',
    timezoneId: 'Australia/Melbourne',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: env.url,
      VITE_SUPABASE_ANON_KEY: env.anonKey,
      // External providers are outside this first suite. Never contact production.
      VITE_API_BASE_URL: 'http://127.0.0.1:4173/e2e-external',
      E2E_SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
})
