import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const localFile = fileURLToPath(new URL('../.env.e2e.local', import.meta.url))
if (existsSync(localFile)) process.loadEnvFile(localFile)

export function testEnvironment() {
  const required = (name: string) => {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`Missing ${name}. Configure the variables in frontend/.env.e2e.example with credentials from a separate test Supabase project.`)
    return value
  }
  const url = required('E2E_SUPABASE_URL')
  const ref = required('E2E_SUPABASE_PROJECT_REF')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${ref}.supabase.co` || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('E2E_SUPABASE_URL must be the HTTPS origin of E2E_SUPABASE_PROJECT_REF.')
  }
  const production = loadEnv('production', root, 'VITE_').VITE_SUPABASE_URL
  if (production && new URL(production).origin === parsed.origin) {
    throw new Error('E2E refuses to use the Supabase project configured for the application. Create a separate test project.')
  }
  return { url: parsed.origin, anonKey: required('E2E_SUPABASE_ANON_KEY'), serviceKey: required('E2E_SUPABASE_SERVICE_ROLE_KEY') }
}
