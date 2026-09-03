import { describe, expect, it } from 'vitest'
import { docCount, docsByChapter, latestReview, type SolutionsManifest } from './logic'

const manifest: SolutionsManifest = {
  updated: '2026-09-03T15:00:00-03:00',
  docs: [
    { id: '1.23', ch: 1, n: 23, file: '1.23.pdf', reviewed: '2026-08-31T17:44:04-03:00' },
    { id: '1.29', ch: 1, n: 29, file: '1.29.pdf', reviewed: '2026-09-01T14:44:27-03:00' },
    { id: '2.4', ch: 2, n: 4, file: '2.4.jpg', reviewed: '2026-09-01T10:00:00-03:00' },
  ],
}

describe('docsByChapter', () => {
  it('groups hrefs by chapter and item', () => {
    const docs = docsByChapter(manifest)
    expect([...docs.keys()]).toEqual([1, 2])
    expect(docs.get(1)!.get(23)).toBe('/fight-against-evil/solutions/1.23.pdf')
    expect(docs.get(1)!.get(29)).toBe('/fight-against-evil/solutions/1.29.pdf')
    expect(docs.get(2)!.get(4)).toBe('/fight-against-evil/solutions/2.4.jpg')
    expect(docs.get(1)!.has(24)).toBe(false)
  })

  it('tolerates a missing manifest and malformed rows', () => {
    expect(docsByChapter(null).size).toBe(0)
    const bad = { updated: '', docs: [{ id: 'x', ch: 1.5, n: 1, file: 'x.pdf', reviewed: '' }, { id: 'y', ch: 1, n: 2, file: '', reviewed: '' }] }
    expect(docsByChapter(bad).size).toBe(0)
  })
})

describe('counts', () => {
  it('reports the number of docs and the newest review', () => {
    expect(docCount(manifest)).toBe(3)
    expect(docCount(null)).toBe(0)
    expect(latestReview(manifest)).toBe('2026-09-01T14:44:27-03:00')
    expect(latestReview(null)).toBeNull()
  })
})
