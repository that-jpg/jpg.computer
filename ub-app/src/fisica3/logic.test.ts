import { describe, expect, it } from 'vitest'
import type { Fisica3Chapter, Fisica3Snapshot } from '../shared/types'
import { badgeText, blockGroups, blockTallies, courseTotals, formatAsOf, pctOf, STALE_MS } from './logic'

function chapter(overrides: Partial<Fisica3Chapter> = {}): Fisica3Chapter {
  return {
    ch: 1,
    title: 'Eletrostática',
    q_start: 11,
    p_start: 21,
    ad_start: 41,
    max: 50,
    solved: [],
    deadline: null,
    status: 'no_date',
    ...overrides,
  }
}

describe('blockGroups', () => {
  it('splits MC, Q and P at the chapter boundaries', () => {
    expect(blockGroups(chapter())).toEqual([
      { label: 'MC', from: 1, to: 10 },
      { label: 'Q', from: 11, to: 20 },
      { label: 'P', from: 21, to: 50 },
    ])
  })
})

describe('blockTallies', () => {
  it('counts solved per block', () => {
    const ch = chapter({ solved: [1, 2, 11, 21, 22, 50] })
    expect(blockTallies(ch)).toBe('MC 2/10 · Q 1/10 · P 3/30')
  })
})

describe('badgeText', () => {
  it('appends the deadline for undone chapters with dates', () => {
    expect(badgeText(chapter({ status: 'behind', deadline: '2026-08-20' }))).toBe('behind · due 2026-08-20')
  })

  it('drops the deadline once done', () => {
    expect(badgeText(chapter({ status: 'done', deadline: '2026-08-20' }))).toBe('done')
  })

  it('maps due_soon to readable text', () => {
    expect(badgeText(chapter({ status: 'due_soon' }))).toBe('due soon')
  })
})

describe('courseTotals and pctOf', () => {
  it('sums across chapters', () => {
    const snap = {
      chapters: [chapter({ solved: [1, 2, 3] }), chapter({ ch: 2, max: 30, solved: [5] })],
    } as Fisica3Snapshot
    const totals = courseTotals(snap)
    expect(totals).toEqual({ total: 80, solved: 4 })
    expect(pctOf(totals.solved, totals.total)).toBe('5.0')
  })

  it('renders 0.0 for an empty course', () => {
    expect(pctOf(0, 0)).toBe('0.0')
  })
})

describe('formatAsOf', () => {
  const updated = '2026-08-11T10:00:00-03:00'

  it('is fresh within 45 minutes', () => {
    const now = new Date(updated).getTime() + STALE_MS - 1000
    const result = formatAsOf(updated, now)
    expect(result.stale).toBe(false)
    expect(result.text).toMatch(/^as of aug 11 \d{2}:\d{2}$/)
  })

  it('goes stale after 45 minutes', () => {
    const now = new Date(updated).getTime() + STALE_MS + 1000
    const result = formatAsOf(updated, now)
    expect(result.stale).toBe(true)
    expect(result.text).toMatch(/^stale — as of aug 11 \d{2}:\d{2}$/)
  })
})
