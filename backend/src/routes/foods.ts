import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'
import { normalizeOFF, normalizeUSDA } from '../lib/externalFoods.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)
const cache = new Map<string, { until: number; foods: unknown[] }>()
let windowStart = Date.now()
let requests = 0
app.get('/search', async c => {
  const q = (c.req.query('q') ?? '').trim()
  const source = c.req.query('source')
  if (!q || q.length > 120 || !['barcode', 'usda'].includes(source ?? '')) return c.json({ error: 'invalid_query' }, 400)
  if (source === 'barcode' && !/^\d{8,14}$/.test(q)) return c.json({ error: 'invalid_barcode' }, 400)
  const key = `${source}:${q.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return c.json({ foods: hit.foods })
  if (source === 'usda' && !process.env.USDA_API_KEY) return c.json({ error: 'source_not_configured' }, 503)
  // Shared upstream budget per process, with bounded cache and timeouts.
  if (Date.now() - windowStart > 60000) { requests = 0; windowStart = Date.now() }
  if (++requests > 20) return c.json({ error: 'rate_limited' }, 429)
  try {
    let foods: unknown[]
    if (source === 'barcode') {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${q}.json?fields=code,product_name,brands,nutriments,product_quantity_unit`, {
        headers: { 'User-Agent': 'FemFit/1.0 (https://github.com/miaon1789/femfit)' }, signal: AbortSignal.timeout(10000),
      })
      if (response.status === 404) return c.json({ foods: [] })
      if (!response.ok) throw new Error('upstream')
      const body = await response.json() as { product?: unknown }
      const food = normalizeOFF(body.product)
      foods = food ? [food] : []
    } else {
      const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
      url.searchParams.set('api_key', process.env.USDA_API_KEY!)
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, pageSize: 25, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] }),
        signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('upstream')
      const body = await response.json() as { foods?: unknown[] }
      foods = (Array.isArray(body.foods) ? body.foods : []).map(normalizeUSDA).filter(Boolean)
    }
    if (cache.size >= 200) cache.delete(cache.keys().next().value!)
    cache.set(key, { until: Date.now() + 3600000, foods })
    return c.json({ foods })
  } catch { return c.json({ error: 'source_unavailable' }, 502) }
})
export default app
