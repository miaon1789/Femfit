import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const checks = [
  ['node', ['--test', 'scripts/tests/agent-hooks.test.mjs']],
  ['npm', ['run', 'typecheck', '--prefix', 'frontend']],
  ['npm', ['run', 'typecheck:e2e', '--prefix', 'frontend']],
  ['npm', ['test', '--prefix', 'frontend']],
  ['npm', ['test', '--prefix', 'backend']],
]

for (const [command, args] of checks) {
  console.log(`\nChecking: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout: 180_000 })
  if (result.error) console.error(result.error.message)
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log('\nAll verification checks passed. Browser E2E execution is separate.')
