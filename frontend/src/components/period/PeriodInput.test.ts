import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { PeriodInput } from './PeriodInput'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(() => vi.useRealTimers())

it('uses the local calendar date for the period default and maximum', () => {
  vi.useFakeTimers()
  // Run with TZ=Australia/Sydney to exercise a local day ahead of UTC.
  vi.setSystemTime(new Date(2026, 0, 6, 8))
  const html = renderToStaticMarkup(createElement(PeriodInput, {
    onAdd: vi.fn(), onMarkEnd: vi.fn(), latestLog: null,
  }))
  expect(html).toContain('max="2026-01-06"')
  expect(html).toContain('value="2026-01-06"')
})
