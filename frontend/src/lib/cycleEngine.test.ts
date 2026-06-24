import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { getPhaseForDate, generatePhaseSegments, computeCycleInfo } from './cycleEngine'

// Standard textbook cycle used across these tests: 28-day cycle, 5-day period.
// With avgCycleDays=28 / avgPeriodDays=5 the phase boundaries (by dayOfCycle) are:
//   menstrual  1–5      follicular 6–12      ovulation 13–16      luteal 17–28
const LAST = '2026-01-01' // dayOfCycle 1 falls on this date
const CYCLE = 28
const PERIOD = 5

describe('getPhaseForDate', () => {
  it('classifies each phase from the day-of-cycle boundaries', () => {
    expect(getPhaseForDate('2026-01-01', LAST, CYCLE, PERIOD)).toBe('menstrual') // day 1
    expect(getPhaseForDate('2026-01-05', LAST, CYCLE, PERIOD)).toBe('menstrual') // day 5
    expect(getPhaseForDate('2026-01-06', LAST, CYCLE, PERIOD)).toBe('follicular') // day 6
    expect(getPhaseForDate('2026-01-11', LAST, CYCLE, PERIOD)).toBe('follicular') // day 11
    expect(getPhaseForDate('2026-01-14', LAST, CYCLE, PERIOD)).toBe('ovulation') // day 14
    expect(getPhaseForDate('2026-01-20', LAST, CYCLE, PERIOD)).toBe('luteal') // day 20
  })

  it('wraps cleanly into the next cycle (modular arithmetic)', () => {
    // 28 days after last period == day 1 of the next cycle
    expect(getPhaseForDate('2026-01-29', LAST, CYCLE, PERIOD)).toBe('menstrual')
  })

  it('handles dates before the last period without going negative', () => {
    // 2 days before the last period should resolve to late luteal, not crash/NaN
    expect(getPhaseForDate('2025-12-30', LAST, CYCLE, PERIOD)).toBe('luteal')
  })
})

describe('generatePhaseSegments', () => {
  it('returns an empty array for no dates', () => {
    expect(generatePhaseSegments([], LAST, CYCLE, PERIOD)).toEqual([])
  })

  it('groups consecutive same-phase days into one segment', () => {
    const segs = generatePhaseSegments(['2026-01-01', '2026-01-02', '2026-01-03'], LAST, CYCLE, PERIOD)
    expect(segs).toEqual([{ start: '2026-01-01', end: '2026-01-03', phase: 'menstrual' }])
  })

  it('splits a segment at a phase boundary', () => {
    const dates = ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07']
    const segs = generatePhaseSegments(dates, LAST, CYCLE, PERIOD)
    expect(segs).toEqual([
      { start: '2026-01-04', end: '2026-01-05', phase: 'menstrual' },
      { start: '2026-01-06', end: '2026-01-07', phase: 'follicular' },
    ])
  })
})

describe('computeCycleInfo', () => {
  it('reports the current phase and day-of-cycle relative to today', () => {
    const lastPeriod = dayjs().subtract(3, 'day').format('YYYY-MM-DD') // day 4
    const info = computeCycleInfo(lastPeriod, CYCLE, PERIOD)
    expect(info.phase).toBe('menstrual')
    expect(info.dayOfCycle).toBe(4)
  })

  it('identifies the luteal phase late in the cycle', () => {
    const lastPeriod = dayjs().subtract(20, 'day').format('YYYY-MM-DD') // day 21
    expect(computeCycleInfo(lastPeriod, CYCLE, PERIOD).phase).toBe('luteal')
  })

  it('always predicts the next period in the future, even after several missed cycles', () => {
    const lastPeriod = dayjs().subtract(70, 'day').format('YYYY-MM-DD')
    const info = computeCycleInfo(lastPeriod, CYCLE, PERIOD)
    expect(dayjs(info.predictedNextPeriod).isAfter(dayjs())).toBe(true)
  })

  it('predicts ovulation 14 days before the next period', () => {
    const lastPeriod = dayjs().subtract(5, 'day').format('YYYY-MM-DD')
    const info = computeCycleInfo(lastPeriod, CYCLE, PERIOD)
    const gap = dayjs(info.predictedNextPeriod).diff(dayjs(info.predictedOvulation), 'day')
    expect(gap).toBe(14)
  })
})
