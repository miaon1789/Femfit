import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

// Set dummy configuration before importing the service-role client. All I/O is mocked.
const envKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'AI_PROVIDER', 'CLAUDE_API_KEY', 'OPENAI_API_KEY']
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.AI_PROVIDER = 'claude'
process.env.CLAUDE_API_KEY = 'test-provider-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
const { default: ai } = await import('../dist/routes/ai.js')
const originalFetch = globalThis.fetch
const originalError = console.error
afterEach(() => { globalThis.fetch = originalFetch; console.error = originalError })
const { after } = await import('node:test')
after(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

const meal = { foods: [{ food_name: 'Rice', quantity: 1, unit: 'bowl', calories: 200,
  protein_g: 4, carbs_g: 44, fat_g: 1, fiber_g: 0, iron_mg: 0 }],
  total_calories: 999, cycle_tip: '' }

function mockServices({ text = JSON.stringify(meal), count = 0, providerStatus = 200, saveStatus = 201,
  quotaStatus = 200, invalidQuota = false, provider = 'claude', hang = false } = {}) {
  process.env.AI_PROVIDER = provider
  const inserts = []
  const logs = []
  let providerCalls = 0
  let attempts = count
  console.error = (...args) => logs.push(args)
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    if (url.includes('/auth/v1/user')) return Response.json({ id: 'test-user', email: 'test@example.com' })
    if (url.includes('/rest/v1/rpc/reserve_ai_meal_attempt')) {
      assert.deepEqual(JSON.parse(options.body), { p_user_id: 'test-user' })
      if (quotaStatus !== 200) return Response.json({ message: 'unavailable' }, { status: quotaStatus })
      if (invalidQuota) return Response.json(null)
      const allowed = attempts < 3
      if (allowed) attempts++
      return Response.json(allowed)
    }
    if (url.includes('/rest/v1/users')) return Response.json({ subscription_tier: 'free', last_period_date: null })
    if (url.includes('/rest/v1/ai_reports')) {
      inserts.push(JSON.parse(options.body))
      return Response.json(saveStatus === 201 ? { id: 'report-1' } : { message: 'database unavailable' }, { status: saveStatus })
    }
    if (url === 'https://api.anthropic.com/v1/messages' || url === 'https://api.openai.com/v1/chat/completions') {
      providerCalls++
      assert.ok(options.signal instanceof AbortSignal)
      if (provider === 'claude') assert.equal(options.headers['x-api-key'], 'test-provider-key')
      else assert.equal(options.headers.Authorization, 'Bearer test-openai-key')
      if (hang) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))
      return Response.json(provider === 'claude' ? { content: [{ text }] }
        : { choices: [{ message: { content: text } }] }, { status: providerStatus })
    }
    throw new Error(`Unexpected test URL: ${url}`)
  }
  return { inserts, logs, providerCalls: () => providerCalls, attempts: () => attempts }
}
function request() {
  return ai.request('/analyze-meal', { method: 'POST', headers: {
    Authorization: 'Bearer test-token', 'Content-Type': 'application/json',
  }, body: JSON.stringify({ description: 'a bowl of rice', meal_type: 'lunch', locale: 'en' }) })
}

test('requires authentication without calling any upstream service', async () => {
  const services = mockServices()
  const response = await ai.request('/analyze-meal', { method: 'POST' })
  assert.equal(response.status, 401)
  assert.equal(services.providerCalls(), 0)
})

test('returns and persists the server total, never the model total', async () => {
  const services = mockServices()
  const response = await request()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.total_calories, 200)
  assert.equal(body.report_id, 'report-1')
  assert.equal(services.inserts.length, 1)
  assert.equal(JSON.parse(services.inserts[0].content).total_calories, 200)
  assert.equal(services.inserts[0].user_id, 'test-user')
})

for (const text of ['broken JSON', JSON.stringify({ ...meal, foods: [{ ...meal.foods[0], calories: '200' }] })]) {
  test('rejects invalid provider output before persistence without logging meal data', async () => {
    const services = mockServices({ text })
    const response = await request()
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: 'ai_invalid_response' })
    assert.equal(services.inserts.length, 0)
    assert.equal(services.logs.length, 1)
    assert.ok(!JSON.stringify(services.logs).includes(text))
    assert.ok(!JSON.stringify(services.logs).includes('a bowl of rice'))
  })
}

test('quota errors use a stable code and skip the provider', async () => {
  const services = mockServices({ count: 3 })
  const response = await request()
  assert.equal(response.status, 429)
  assert.deepEqual(await response.json(), { error: 'ai_daily_limit' })
  assert.equal(services.providerCalls(), 0)
})

test('provider failures do not persist reports', async () => {
  const services = mockServices({ providerStatus: 503 })
  const response = await request()
  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: 'ai_analysis_failed' })
  assert.equal(services.inserts.length, 0)
})

test('a failed report insert cannot be reported as success', async () => {
  mockServices({ saveStatus: 500 })
  const response = await request()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'ai_report_save_failed' })
})

for (const options of [{ quotaStatus: 503 }, { invalidQuota: true }]) {
  test('quota reservation failures stop the request before spending AI usage', async () => {
    const services = mockServices(options)
    const response = await request()
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'ai_quota_unavailable' })
    assert.equal(services.providerCalls(), 0)
    assert.equal(services.inserts.length, 0)
  })
}

test('concurrent requests must each reserve a slot and cannot exceed the RPC allowance', async () => {
  const services = mockServices({ count: 2 })
  const responses = await Promise.all([request(), request()])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 429])
  assert.equal(services.providerCalls(), 1)
  assert.equal(services.attempts(), 3)
})

test('provider failures still consume the authorized attempt', async () => {
  const services = mockServices({ providerStatus: 503, count: 2 })
  assert.equal((await request()).status, 502)
  assert.equal((await request()).status, 429)
  assert.equal(services.providerCalls(), 1)
  assert.equal(services.attempts(), 3)
})

test('the OpenAI branch uses the configured key and validates before saving', async () => {
  const services = mockServices({ provider: 'openai' })
  const response = await request()
  assert.equal(response.status, 200)
  assert.equal((await response.json()).total_calories, 200)
  assert.equal(services.inserts.length, 1)
})

for (const provider of ['claude', 'openai']) {
  test(`${provider} requests abort at the configured deadline without saving a report`, async () => {
    const originalTimeout = AbortSignal.timeout
    AbortSignal.timeout = milliseconds => {
      assert.equal(milliseconds, 30_000)
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 5)
      return controller.signal
    }
    try {
      const services = mockServices({ provider, hang: true })
      assert.equal((await request()).status, 502)
      assert.equal(services.inserts.length, 0)
      assert.equal(services.attempts(), 1)
    } finally { AbortSignal.timeout = originalTimeout }
  })
}
