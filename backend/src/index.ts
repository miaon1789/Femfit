import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import usersRouter from './routes/users.js'
import aiRouter from './routes/ai.js'

const app = new Hono()

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', service: 'femfit-backend', ts: new Date().toISOString() }))

app.route('/api/users', usersRouter)
app.route('/api/ai', aiRouter)

// ── 404 ────────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('[Error]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Start ──────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? '3000')
console.log(`🌸 FemFit backend running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
