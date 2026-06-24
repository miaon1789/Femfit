import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Standalone Vitest config: the engines under test are pure functions, so we run in a
// plain Node environment and skip the app's Vite/PWA plugin stack for fast unit tests.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
