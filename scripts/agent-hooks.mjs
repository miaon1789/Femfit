import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, basename, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const lockNames = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb'])

// Resolve existing parents too, so new files below symlinked directories are covered.
function canonical(path) {
  if (existsSync(path)) return realpathSync(path)
  const parent = dirname(path)
  return parent === path ? path : join(canonical(parent), basename(path))
}

export function isProtectedPath(path, root = projectRoot, cwd = root) {
  const absolute = resolve(cwd, path)
  const paths = [absolute, canonical(absolute)]
  const roots = [resolve(root), canonical(resolve(root))]
  return paths.some(candidate => basename(candidate).startsWith('.env')
    || lockNames.has(basename(candidate))
    || roots.some(base => {
      const rel = relative(base, candidate).split(sep).join('/')
      return rel === 'supabase/migrations' || rel.startsWith('supabase/migrations/')
    }))
}

export function guardTool(input, root = projectRoot) {
  const tool = input.tool_name
  const args = input.tool_input ?? {}
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const path = args.file_path ?? args.notebook_path
    if (typeof path !== 'string') return 'Cannot determine the edit target. Use a tool with an explicit file path.'
    if (isProtectedPath(path, root, input.cwd ?? root)) {
      return 'Protected file: environment files, migrations and lockfiles require an owner-managed change. Explain the required change and let the owner apply it.'
    }
  }
  if (tool === 'Bash') {
    const command = args.command ?? ''
    // Deliberately conservative, including read commands that name protected paths.
    const protectedReference = /(?:^|[\s/"'`=])\.env[^\s/]*|supabase[\\/]+migrations|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?/.test(command)
    const dependencyMutation = /\b(?:npm|pnpm|yarn|bun)\b/.test(command)
      && /\b(?:i|install|ci|add|remove|uninstall|update|upgrade|import|dedupe|audit\s+fix)\b/.test(command)
    const gitRewrite = /\bgit\s+(?:-[^\s]+\s+)*(?:reset|checkout|restore|clean|apply|am|rebase|merge|cherry-pick)\b/.test(command)
    if (protectedReference || dependencyMutation || gitRewrite) {
      return 'Command may modify protected files. Use targeted edits outside .env*, supabase/migrations and lockfiles. Dependency installation and Git rewrites are owner-managed.'
    }
  }
  return null
}

export function runStopGate(input, { root = projectRoot, runCheck, stateDir = join(root, '.claude', '.state') } = {}) {
  const key = createHash('sha256').update(String(input.session_id ?? 'unknown')).digest('hex')
  mkdirSync(stateDir, { recursive: true })
  const stateFile = join(stateDir, `${key}.json`)
  let failures = 0
  if (input.stop_hook_active) {
    try { failures = JSON.parse(readFileSync(stateFile, 'utf8')).failures ?? 0 } catch { /* First attempt. */ }
  }
  if (failures >= 3) {
    return { status: 0, message: 'Verification still fails after three attempts. Human handoff required. Do not claim completion or commit. Run npm run verify after fixing the failures.', handoff: true }
  }
  const result = runCheck ? runCheck() : spawnSync(process.execPath, [join(root, 'scripts/verify.mjs')], {
    cwd: root, encoding: 'utf8', timeout: 240_000, maxBuffer: 2 * 1024 * 1024,
  })
  if (result.status === 0 && !result.error) {
    writeFileSync(stateFile, JSON.stringify({ failures: 0 }))
    return { status: 0, message: 'Verification passed.' }
  }
  writeFileSync(stateFile, JSON.stringify({ failures: failures + 1 }))
  // Keep useful failure context bounded before returning it to the agent.
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`.slice(-14000)
  return { status: 2, message: `Verification failed (attempt ${failures + 1}/3). Fix the errors and rerun npm run verify.\n${output}` }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'))
    if (process.argv[2] === 'guard') {
      const reason = guardTool(input)
      if (reason) { console.error(reason); process.exitCode = 2 }
    } else if (process.argv[2] === 'stop') {
      const result = runStopGate(input)
      if (result.handoff) console.log(JSON.stringify({ systemMessage: result.message }))
      else if (result.status) console.error(result.message)
      process.exitCode = result.status
    } else {
      throw new Error('Expected guard or stop mode')
    }
  } catch (error) {
    console.error(`FemFit hook failed: ${error.message}`)
    process.exitCode = 2
  }
}
