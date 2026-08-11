import { describe, expect, it } from 'vitest'
import type { FinanceMonth } from '../shared/types'
import { barPath, cumulativePieces, dayNum, fillDays, isoAddDays, linePath, rollingAccuracy, spendCategories, timeScale } from './chartMath'

describe('date math', () => {
  it('adds days across dst-free iso dates', () => {
    expect(isoAddDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(isoAddDays('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('daynum is monotonic by one per day', () => {
    expect(dayNum('2026-08-12') - dayNum('2026-08-11')).toBe(1)
  })
})

describe('paths', () => {
  it('draws a squared bar when nearly flat', () => {
    expect(barPath(10, 99.5, 8, 100)).toMatch(/^M10,100 L10,99\.5/)
  })

  it('rounds tall bars', () => {
    expect(barPath(10, 50, 8, 100)).toContain('Q')
  })

  it('builds a move-then-line path', () => {
    expect(linePath([[1, 2], [3, 4]])).toBe('M1.0,2.0 L3.0,4.0')
  })
})

describe('timeScale', () => {
  it('maps the domain edges onto the plot area', () => {
    const c = timeScale({ h: 150, xMin: '2026-08-01', xMax: '2026-08-31', yMin: 0, yMax: 100 })
    expect(c.xOf('2026-08-01')).toBe(c.box.left)
    expect(c.xOf('2026-08-31')).toBe(c.box.w - c.box.right)
    expect(c.yOf(100)).toBe(c.box.top)
    expect(c.yOf(0)).toBe(c.baseY)
  })

  it('centers a single-day domain', () => {
    const c = timeScale({ h: 150, xMin: '2026-08-01', xMax: '2026-08-01', yMin: 0, yMax: 1 })
    expect(c.xOf('2026-08-01')).toBe(c.box.left + c.plotW / 2)
  })
})

describe('rollingAccuracy', () => {
  it('computes a 7-day window and fills gap days', () => {
    const points = rollingAccuracy([
      { date: '2026-08-01', reviews: 10, correct: 8 },
      { date: '2026-08-03', reviews: 10, correct: 6 },
    ])
    expect(points).toHaveLength(3)
    expect(points[0].pct).toBe(80)
    expect(points[1].pct).toBe(80)
    expect(points[2]).toMatchObject({ reviews: 20, pct: 70 })
  })

  it('drops days outside the window to null', () => {
    const points = rollingAccuracy([
      { date: '2026-08-01', reviews: 10, correct: 8 },
      { date: '2026-08-20', reviews: 10, correct: 10 },
    ])
    const mid = points.find(p => p.date === '2026-08-10')!
    expect(mid.pct).toBeNull()
  })
})

describe('fillDays', () => {
  it('inserts zero days between sparse points', () => {
    const days = fillDays([
      { date: '2026-08-01', reviews: 5, correct: 5 },
      { date: '2026-08-04', reviews: 3, correct: 2 },
    ])
    expect(days.map(d => d.reviews)).toEqual([5, 0, 0, 3])
  })
})

describe('spendCategories', () => {
  it('ranks categories by total and caps at the palette size', () => {
    const months: FinanceMonth[] = [
      { month: '2026-06', income: 0, spend: 0, net: 0, by_category: { a: 10, b: 90, c: 20, d: 30, e: 40, f: 50 } },
      { month: '2026-07', income: 0, spend: 0, net: 0, by_category: { a: 100 } },
    ]
    expect(spendCategories(months)).toEqual(['a', 'b', 'f', 'e', 'd'])
  })
})

describe('cumulativePieces', () => {
  it('accumulates thrown counts', () => {
    expect(cumulativePieces([
      { date: '2026-08-01', thrown: 3 },
      { date: '2026-08-05', thrown: 4 },
    ]).map(p => p.total)).toEqual([3, 7])
  })
})
