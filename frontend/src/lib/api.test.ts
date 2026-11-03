import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInstance } from 'i18next'
import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'
import { analyzeMeal, getMealAnalysisErrorKey } from './api'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
} } }))
afterEach(() => vi.unstubAllGlobals())
const input = { description: 'rice', meal_type: 'lunch' as const }

describe('meal analysis errors', () => {
  it.each([
    [429, { error: 'ai_daily_limit' }, 'food.aiDailyLimit'],
    [401, { error: '无效的认证令牌' }, 'food.aiSignIn'],
    [502, { error: 'ai_invalid_response' }, 'food.aiInvalidResponse'],
    [502, { error: 'ai_analysis_failed' }, 'food.aiFailed'],
    [503, { error: 'ai_quota_unavailable' }, 'food.aiQuotaUnavailable'],
    [413, { error: 'ai_image_too_large' }, 'food.photoTooLarge'],
    [400, { error: 'ai_invalid_image' }, 'food.photoFailed'],
    [400, { error: 'ai_meal_input_required' }, 'food.errDescribe'],
    [400, { error: 'ai_invalid_input' }, 'food.aiInputInvalid'],
    [500, { error: 'AI 分析失败，请重试' }, 'food.aiFailed'],
    [500, null, 'food.aiFailed'],
  ])('maps status %s to a local translation key', async (status, body, key) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))
    const error = await analyzeMeal(input).catch(e => e)
    expect(getMealAnalysisErrorKey(error)).toBe(key)
  })

  it('handles non-JSON errors and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })))
    expect(getMealAnalysisErrorKey(await analyzeMeal(input).catch(e => e))).toBe('food.aiFailed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    expect(getMealAnalysisErrorKey(await analyzeMeal(input).catch(e => e))).toBe('food.aiFailed')
  })

  it.each(['en', 'zh'])('renders invalid-output errors in %s', async locale => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'ai_invalid_response' }, { status: 502 })))
    const i18n = createInstance()
    await i18n.init({ lng: locale, resources: { en: { translation: en }, zh: { translation: zh } } })
    const key = getMealAnalysisErrorKey(await analyzeMeal(input).catch(e => e))
    expect(i18n.t(key)).toBe((locale === 'en' ? en : zh).food.aiInvalidResponse)
    if (locale === 'en') expect(i18n.t(key)).not.toMatch(/[\u4e00-\u9fff]/)
  })

  it('sends the session token and returns a successful result', async () => {
    const result = { foods: [], total_calories: 0, cycle_tip: '' }
    const fetch = vi.fn().mockResolvedValue(Response.json(result))
    vi.stubGlobal('fetch', fetch)
    expect(await analyzeMeal(input)).toEqual(result)
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  })

  it('sends an image and optional notes together, with cancellation support', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ foods: [], total_calories: 0, cycle_tip: '' }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const image = { media_type: 'image/jpeg' as const, data: '/9j/AA==' }
    await analyzeMeal({ ...input, image }, controller.signal)
    const options = fetch.mock.calls[0][1]
    expect(JSON.parse(options.body)).toMatchObject({ description: 'rice', image })
    expect(options.signal).toBe(controller.signal)
  })
})
