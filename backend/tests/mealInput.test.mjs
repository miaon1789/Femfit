import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_MEAL_REQUEST_BYTES, readMealInput } from '../dist/lib/mealInput.js'

test('rejects malformed JSON without exposing its contents', async () => {
  await assert.rejects(readMealInput(new Request('http://local.test', { method: 'POST', body: '{private text' })),
    error => error.code === 'ai_invalid_input' && !error.message.includes('private text'))
})

test('rejects a declared oversize body before reading its stream', async () => {
  const request = new Request('http://local.test', { method: 'POST',
    headers: { 'content-length': String(MAX_MEAL_REQUEST_BYTES + 1) }, body: '{}' })
  await assert.rejects(readMealInput(request), error => error.status === 413)
  assert.equal(request.bodyUsed, false)
})

for (const contentLength of [undefined, '1']) {
  test('limits streamed bytes even with absent or misleading Content-Length', async () => {
    let cancelled = false
    let chunks = 0
    const body = new ReadableStream({
      pull(controller) {
        chunks++
        controller.enqueue(new Uint8Array(1024 * 1024))
      },
      cancel() { cancelled = true },
    })
    const request = new Request('http://local.test', { method: 'POST', body, duplex: 'half',
      headers: contentLength ? { 'content-length': contentLength } : {} })
    await assert.rejects(readMealInput(request), error => error.status === 413)
    assert.equal(cancelled, true)
    assert.ok(chunks <= 5)
  })
}
