import { defineConfig, devices } from '@playwright/test'

// Production-build browser checks use synthetic accounts and intercepted APIs.
// They do not require a Supabase project or provider keys.
export default defineConfig({
  testDir: './smoke', workers: 1, fullyParallel: false, forbidOnly: !!process.env.CI,
  timeout: 45_000, expect: { timeout: 10_000 }, reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174', locale: 'en-AU', timezoneId: 'Australia/Melbourne',
    serviceWorkers: 'block', screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build -- --outDir dist-smoke && npm run preview -- --outDir dist-smoke --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 90_000,
    env: {
      VITE_SUPABASE_URL: 'https://femfit-smoke.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'synthetic-anon-key',
      VITE_API_BASE_URL: 'http://127.0.0.1:4174/synthetic-api',
    },
  },
})
