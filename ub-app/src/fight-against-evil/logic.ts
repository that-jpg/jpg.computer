export const SOLUTIONS_BASE = '/fight-against-evil/solutions/'

export interface SolutionDoc {
  id: string
  ch: number
  n: number
  file: string
  reviewed: string
}

export interface SolutionsManifest {
  updated: string
  docs: SolutionDoc[]
}

/** chapter → (item number → href) for the solutions reviewed as correct. */
export function docsByChapter(manifest: SolutionsManifest | null): Map<number, Map<number, string>> {
  const result = new Map<number, Map<number, string>>()
  for (const doc of manifest?.docs ?? []) {
    if (!Number.isInteger(doc.ch) || !Number.isInteger(doc.n) || !doc.file) continue
    if (!result.has(doc.ch)) result.set(doc.ch, new Map())
    result.get(doc.ch)!.set(doc.n, SOLUTIONS_BASE + encodeURIComponent(doc.file))
  }
  return result
}

export function docCount(manifest: SolutionsManifest | null): number {
  return manifest?.docs.length ?? 0
}

export function latestReview(manifest: SolutionsManifest | null): string | null {
  const times = (manifest?.docs ?? []).map(d => d.reviewed).filter(Boolean).sort()
  return times.length ? times[times.length - 1] : null
}
