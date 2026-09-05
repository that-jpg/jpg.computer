export const SOLUTIONS_BASE = '/fight-against-evil/solutions/'

export interface SolutionDoc {
  id: string
  ch: number
  n: number
  file: string
  reviewed: string
  verdict?: 'correct' | 'wrong'
}

export interface SolutionLink {
  href: string
  verdict: 'correct' | 'wrong'
}

export interface SolutionsManifest {
  updated: string
  docs: SolutionDoc[]
}

/** chapter → (item number → link) for every reviewed document: the correct solution, or the latest wrong attempt of a flagged item. */
export function docsByChapter(manifest: SolutionsManifest | null): Map<number, Map<number, SolutionLink>> {
  const result = new Map<number, Map<number, SolutionLink>>()
  for (const doc of manifest?.docs ?? []) {
    if (!Number.isInteger(doc.ch) || !Number.isInteger(doc.n) || !doc.file) continue
    if (!result.has(doc.ch)) result.set(doc.ch, new Map())
    result.get(doc.ch)!.set(doc.n, {
      href: SOLUTIONS_BASE + encodeURIComponent(doc.file),
      verdict: doc.verdict === 'wrong' ? 'wrong' : 'correct',
    })
  }
  return result
}

export function docCounts(manifest: SolutionsManifest | null): { correct: number; wrong: number } {
  const docs = manifest?.docs ?? []
  const wrong = docs.filter(d => d.verdict === 'wrong').length
  return { correct: docs.length - wrong, wrong }
}

export function docCount(manifest: SolutionsManifest | null): number {
  return manifest?.docs.length ?? 0
}

export function latestReview(manifest: SolutionsManifest | null): string | null {
  const times = (manifest?.docs ?? []).map(d => d.reviewed).filter(Boolean).sort()
  return times.length ? times[times.length - 1] : null
}
