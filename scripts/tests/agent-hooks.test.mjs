import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { guardTool, isProtectedPath, runStopGate } from '../agent-hooks.mjs'

test('blocks protected edit targets, including traversal and symlinks', () => {
  const root = mkdtempSync(join(tmpdir(), 'femfit-guard-'))
  try {
    mkdirSync(join(root, 'supabase/migrations'), { recursive: true })
    symlinkSync(join(root, 'supabase/migrations'), join(root, 'alias'))
    for (const file of ['.env', 'frontend/.env.local', 'backend/package-lock.json',
      'supabase/migrations/new.sql', 'frontend/../supabase/migrations/new.sql', 'alias/new.sql']) {
      assert.equal(isProtectedPath(file, root), true, file)
      assert.ok(guardTool({ tool_name: 'Edit', tool_input: { file_path: file } }, root), file)
    }
    writeFileSync(join(root, '.env'), '')
    symlinkSync(join(root, '.env'), join(root, 'config'))
    assert.equal(isProtectedPath('config', root), true)
    assert.equal(isProtectedPath('backend/src/routes/ai.ts', root), false)
    assert.equal(guardTool({ tool_name: 'Write', tool_input: { file_path: 'README.md' } }, root), null)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('blocks common shell bypasses and permits the verification entry point', () => {
  for (const command of ['echo bad > frontend/.env', 'rm backend/package-lock.json',
    'cp /tmp/migration.sql supabase/migrations/new.sql', 'npm --prefix frontend install zod',
    'npm run install:all', 'git restore .', 'git reset --hard']) {
    assert.ok(guardTool({ tool_name: 'Bash', tool_input: { command } }), command)
  }
  for (const command of ['npm run verify', 'git diff --check', 'npm test --prefix backend']) {
    assert.equal(guardTool({ tool_name: 'Bash', tool_input: { command } }), null, command)
  }
})

test('guard CLI returns exit code 2 to Claude with a reason', () => {
  const result = spawnSync(process.execPath, ['scripts/agent-hooks.mjs', 'guard'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'backend/.env' } }), encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Protected file/)
})

test('stop gate blocks failures, reruns checks, and hands off after three attempts', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'femfit-stop-'))
  let checks = 0
  const options = { stateDir, runCheck: () => { checks++; return { status: 1, stderr: 'test failed' } } }
  try {
    assert.equal(runStopGate({ session_id: 'a', stop_hook_active: false }, options).status, 2)
    for (let i = 0; i < 2; i++) assert.equal(runStopGate({ session_id: 'a', stop_hook_active: true }, options).status, 2)
    const handoff = runStopGate({ session_id: 'a', stop_hook_active: true }, options)
    assert.equal(handoff.status, 0)
    assert.equal(handoff.handoff, true)
    assert.equal(checks, 3)
    assert.equal(runStopGate({ session_id: 'b', stop_hook_active: true }, options).status, 2)
    assert.equal(runStopGate({ session_id: 'a', stop_hook_active: false }, options).status, 2)
  } finally { rmSync(stateDir, { recursive: true, force: true }) }
})

test('stop gate permits success only after rerunning verification, including after a failed attempt', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'femfit-stop-'))
  try {
    const input = { session_id: 'a', stop_hook_active: true }
    assert.equal(runStopGate(input, { stateDir, runCheck: () => ({ status: 1 }) }).status, 2)
    let checks = 0
    const options = { stateDir, runCheck: () => { checks++; return { status: 0 } } }
    assert.equal(runStopGate(input, options).status, 0)
    assert.equal(runStopGate(input, options).status, 0)
    assert.equal(checks, 2)
  } finally { rmSync(stateDir, { recursive: true, force: true }) }
})
