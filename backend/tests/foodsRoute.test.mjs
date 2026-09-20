import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import foods from '../dist/routes/foods.js'

const originalFetch = globalThis.fetch
const originalKey = process.env.USDA_API_KEY
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-key'
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.USDA_API_KEY
  else process.env.USDA_API_KEY = originalKey
})
function mockFetch(upstream) {
  globalThis.fetch = async (input, options) => {
    if (String(input).includes('/auth/v1/user')) return Response.json({ id: 'test-user', email: 'test@example.com' })
    return upstream(input, options)
  }
}
const headers = { Authorization: 'Bearer test-token' }
test('food discovery requires authentication', async () => {
  assert.equal((await foods.request('/search?q=rice&source=usda')).status, 401)
})
test('barcode queries validate input before contacting the provider', async () => {
  mockFetch(() => { throw new Error('should not call upstream') })
  assert.equal((await foods.request('/search?q=abc&source=barcode', { headers })).status, 400)
})
test('USDA missing configuration is explicit', async () => {
  delete process.env.USDA_API_KEY
  mockFetch(() => { throw new Error('should not call upstream') })
  const response = await foods.request('/search?q=rice&source=usda', { headers })
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error, 'source_not_configured')
})
test('barcode results normalize and reuse the upstream cache', async () => {
  let calls = 0
  mockFetch(() => {
    calls++
    return Response.json({ product: { code: '12345678', product_name: 'Milk', product_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 60 } } })
  })
  const response = await foods.request('/search?q=12345678&source=barcode', { headers })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.foods[0].calories, 60)
  assert.equal(body.foods[0].serving_unit, 'ml')
  await foods.request('/search?q=12345678&source=barcode', { headers })
  assert.equal(calls, 1)
})
test('provider failure remains distinct from no matches', async () => {
  mockFetch(() => new Response('down', { status: 500 }))
  const response = await foods.request('/search?q=87654321&source=barcode', { headers })
  assert.equal(response.status, 502)
  assert.equal((await response.json()).error, 'source_unavailable')
})
