import type { Goal, GoalsSnapshot, ProjectEntry, ProjectsSnapshot, Todo } from '../shared/types'

export interface Card {
  key: string
  title: string
  status?: 'active' | 'paused'
  note?: string | null
  untracked?: boolean
  meters: Goal['meters']
  items: Todo[]
}

export function registryEntries(snap: ProjectsSnapshot | null): ProjectEntry[] {
  return snap && Array.isArray(snap.projects) ? snap.projects : []
}

export function knownProjects(
  goalsSnap: GoalsSnapshot | null,
  projectsSnap: ProjectsSnapshot | null,
  todos: Todo[],
): string[] {
  const keys: string[] = []
  for (const g of goalsSnap ? goalsSnap.goals : []) keys.push(g.key)
  for (const p of registryEntries(projectsSnap)) {
    if (!keys.includes(p.slug)) keys.push(p.slug)
  }
  for (const t of todos) {
    if (t.project && !keys.includes(t.project)) keys.push(t.project)
  }
  return keys
}

export function monthCards(goalsSnap: GoalsSnapshot | null, byProject: Record<string, Todo[]>): Card[] {
  return (goalsSnap ? goalsSnap.goals : [])
    .map(g => ({
      key: g.key,
      title: g.title,
      meters: g.meters,
      items: byProject[g.key] || [],
    }))
    .filter(c => c.meters.length > 0 || c.items.length > 0)
}

export function behindCount(goalsSnap: GoalsSnapshot | null): number {
  const meters = (goalsSnap ? goalsSnap.goals : []).flatMap(g => g.meters)
  return meters.filter(m => m.ok === false).length
}

export function projectCards(
  goalsSnap: GoalsSnapshot | null,
  projectsSnap: ProjectsSnapshot | null,
  byProject: Record<string, Todo[]>,
): Card[] {
  const goalKeys = (goalsSnap ? goalsSnap.goals : []).map(g => g.key)
  const registry = registryEntries(projectsSnap).filter(p => !goalKeys.includes(p.slug))
  const registrySlugs = registry.map(p => p.slug)
  const untracked: ProjectEntry[] = Object.keys(byProject)
    .filter(slug => !goalKeys.includes(slug) && !registrySlugs.includes(slug))
    .map(slug => ({ slug, title: slug, status: 'active', note: null, untracked: true }))

  const entries = [
    ...registry.filter(p => p.status !== 'paused'),
    ...untracked,
    ...registry.filter(p => p.status === 'paused'),
  ]
  return entries.map(p => ({
    key: p.slug,
    title: p.title,
    status: p.status,
    note: p.note,
    untracked: Boolean(p.untracked),
    meters: [],
    items: byProject[p.slug] || [],
  }))
}
