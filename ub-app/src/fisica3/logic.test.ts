import { describe, expect, it } from 'vitest'
import type { Fisica3Chapter, Fisica3Snapshot } from '../shared/types'
import { badgeText, blockGroups, blockTallies, chapterTotal, courseTotals, formatAsOf, pctOf, redoText, STALE_MS, stupidSet, stupidText, wrongSet } from './logic'

function chapter(overrides: Partial<Fisica3Chapter> = {}): Fisica3Chapter {
  return {
    ch: 1,
    title: 'Eletrostática',
    q_start: 11,
    p_start: 21,
    ad_start: 41,
    max: 50,
    solved: [],
    wrong: [],
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
    expect(totals).toEqual({ total: 80, solved: 4, wrong: 0, stupid: 0 })
    expect(pctOf(totals.solved, totals.total)).toBe('5.0')
  })

  it('counts wrong items across chapters', () => {
    const snap = {
      chapters: [chapter({ solved: [1, 2, 3], wrong: [2] }), chapter({ ch: 2, max: 30, solved: [5], wrong: [5] })],
    } as Fisica3Snapshot
    expect(courseTotals(snap).wrong).toBe(2)
  })
})

describe('wrongSet and redoText', () => {
  it('tolerates snapshots without the wrong field', () => {
    const legacy = { ...chapter(), wrong: undefined } as unknown as Fisica3Chapter
    expect(wrongSet(legacy).size).toBe(0)
    expect(wrongSet(chapter({ wrong: [3, 4] }))).toEqual(new Set([3, 4]))
  })

  it('formats the redo suffix', () => {
    expect(redoText(0)).toBe('')
    expect(redoText(2)).toBe(' · 2 to redo')
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

describe('stupid items', () => {
  it('leave the totals and the block tallies', () => {
    const ch = chapter({ solved: [1, 2, 11], stupid: [3, 12, 50] })
    expect(stupidSet(ch)).toEqual(new Set([3, 12, 50]))
    expect(chapterTotal(ch)).toBe(47)
    expect(blockTallies(ch)).toBe('MC 2/9 · Q 1/9 · P 0/29')
    expect(stupidText(0)).toBe('')
    expect(stupidText(2)).toBe(' · 2 stupid')
    const totals = courseTotals({ chapters: [ch, chapter({ ch: 2, max: 30, solved: [5] })] } as Fisica3Snapshot)
    expect(totals).toEqual({ total: 77, solved: 4, wrong: 0, stupid: 3 })
  })

  it('tolerates snapshots without the field', () => {
    expect(chapterTotal(chapter())).toBe(50)
    expect(stupidSet(chapter()).size).toBe(0)
  })
})
