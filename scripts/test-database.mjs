import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = [
  'supabase/tests/bootstrap.sql', 'supabase/schema.sql',
  'supabase/migrations/001_add_exercise_logs.sql', 'supabase/migrations/002_food_discovery.sql',
  'supabase/tests/quota-fixtures.sql', 'supabase/migrations/003_private_profiles_and_ai_quota.sql',
  'supabase/tests/security-and-quota.sql',
]
const reservation = "select public.reserve_ai_meal_attempt('00000000-0000-0000-0000-000000000006') as allowed"

if (process.argv[2] === '--pglite') {
  // Optional local fallback when Docker/PostgreSQL is unavailable. This runtime
  // lives outside the repository, with no project dependency or lockfile change.
  const runtime = resolve(process.argv[3])
  const { PGlite } = await import(pathToFileURL(join(runtime, 'dist/index.js')).href)
  const { uuid_ossp } = await import(pathToFileURL(join(runtime, 'dist/contrib/uuid_ossp.js')).href)
  const db = new PGlite({ extensions: { uuid_ossp } })
  try {
    for (const path of files) {
      await db.exec(await readFile(join(root, path), 'utf8'))
      console.log(`Passed: ${path}`)
    }
    const results = await Promise.all(Array.from({ length: 10 }, () => db.query(reservation)))
    assert.equal(results.filter(result => result.rows[0].allowed).length, 3)
    console.log('PGlite permissions and quota assertions passed. Its single connection serializes calls. PostgreSQL CI tests real concurrent connections.')
  } finally { await db.close() }
} else {
  // Refuse hosted databases. The target must be an empty, dedicated local DB.
  if (!['localhost', '127.0.0.1'].includes(process.env.PGHOST) || process.env.PGDATABASE !== 'femfit_test') {
    throw new Error('Set PGHOST to localhost/127.0.0.1 and PGDATABASE=femfit_test for an empty local test database.')
  }
  function psql(args) {
    return new Promise((resolveResult, reject) => {
      const child = spawn('psql', ['-X', '-v', 'ON_ERROR_STOP=1', ...args], { cwd: root, env: process.env })
      let stdout = ''; let stderr = ''
      child.stdout.on('data', data => { stdout += data })
      child.stderr.on('data', data => { stderr += data })
      child.on('error', reject)
      child.on('close', code => code === 0 ? resolveResult(stdout) : reject(new Error(stderr)))
    })
  }
  for (const path of files) {
    await psql(['-f', path])
    console.log(`Passed: ${path}`)
  }
  const results = await Promise.all(Array.from({ length: 10 }, () => psql(['-At', '-c', `set role service_role; ${reservation}`])))
  assert.equal(results.filter(output => output.trim().split('\n').at(-1) === 't').length, 3)
  console.log('PostgreSQL permissions and quota assertions passed, including 10 concurrent connections with exactly 3 reservations.')
}
