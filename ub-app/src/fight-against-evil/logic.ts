export const SOLUTIONS_BASE = '/fight-against-evil/solutions/'

export interface SolutionDoc {
  id: string
  ch: number
  n: number
  attempt?: number
  file: string
  reviewed: string
  verdict?: 'correct' | 'wrong'
}

export interface SolutionsManifest {
  updated: string
  docs: SolutionDoc[]
}

export interface Attempt {
  href: string
  attempt: number
  reviewed: string
  verdict: 'correct' | 'wrong'
}

/** chapter → (item number → every reviewed submission, in attempt order). */
export function docsByChapter(manifest: SolutionsManifest | null): Map<number, Map<number, Attempt[]>> {
  const result = new Map<number, Map<number, Attempt[]>>()
  for (const doc of manifest?.docs ?? []) {
    if (!Number.isInteger(doc.ch) || !Number.isInteger(doc.n) || !doc.file) continue
    if (!result.has(doc.ch)) result.set(doc.ch, new Map())
    const items = result.get(doc.ch)!
    if (!items.has(doc.n)) items.set(doc.n, [])
    items.get(doc.n)!.push({
      href: SOLUTIONS_BASE + encodeURIComponent(doc.file),
      attempt: doc.attempt ?? items.get(doc.n)!.length + 1,
      reviewed: doc.reviewed,
      verdict: doc.verdict === 'wrong' ? 'wrong' : 'correct',
    })
  }
  for (const items of result.values()) for (const attempts of items.values()) attempts.sort((a, b) => a.attempt - b.attempt)
  return result
}

/** Distinct items with at least one reviewed submission. */
export function docCount(manifest: SolutionsManifest | null): number {
  return new Set((manifest?.docs ?? []).map(d => d.id)).size
}

export function submissionCount(manifest: SolutionsManifest | null): number {
  return manifest?.docs.length ?? 0
}

export function latestReview(manifest: SolutionsManifest | null): string | null {
  const times = (manifest?.docs ?? []).map(d => d.reviewed).filter(Boolean).sort()
  return times.length ? times[times.length - 1] : null
}
