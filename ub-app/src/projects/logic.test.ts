import { describe, expect, it } from 'vitest'
import { cardBuckets, inboxOf, itemsByProject, nextStateOf, stateOf } from '../shared/todos'
import type { GoalsSnapshot, ProjectsSnapshot, Todo } from '../shared/types'
import { behindCount, knownProjects, monthCards, projectCards } from './logic'

function todo(overrides: Partial<Todo>): Todo {
  return { id: Math.random().toString(36).slice(2), text: 'x', done: false, ...overrides }
}

const TODAY = '2026-08-11'

describe('state cycle', () => {
  it('cycles todo -> doing -> done -> todo', () => {
    expect(nextStateOf(todo({}))).toBe('doing')
    expect(nextStateOf(todo({ state: 'doing' }))).toBe('done')
    expect(nextStateOf(todo({ state: 'done' }))).toBe('todo')
  })

  it('falls back to the legacy done flag', () => {
    expect(stateOf(todo({ done: true }))).toBe('done')
    expect(stateOf(todo({ done: false }))).toBe('todo')
  })
})

describe('inboxOf', () => {
  it('keeps only undone unprojected global todos that are undated or future-dated', () => {
    const todos = [
      todo({ id: 'a' }),
      todo({ id: 'b', due: '2026-08-20' }),
      todo({ id: 'c', due: TODAY }),
      todo({ id: 'd', project: 'iwa' }),
      todo({ id: 'e', kind: 'daily' }),
      todo({ id: 'f', state: 'done' }),
    ]
    expect(inboxOf(todos, TODAY).map(t => t.id)).toEqual(['a', 'b'])
  })
})

describe('cardBuckets', () => {
  it('orders overdue, next upcoming, undated; folds the rest', () => {
    const items = [
      todo({ id: 'undated' }),
      todo({ id: 'later', due: '2026-08-25' }),
      todo({ id: 'soon', due: '2026-08-12' }),
      todo({ id: 'over', due: '2026-08-01' }),
      todo({ id: 'done1', state: 'done', due: '2026-08-05' }),
    ]
    const buckets = cardBuckets(items, TODAY)
    expect(buckets.visible.map(t => t.id)).toEqual(['over', 'soon', 'undated'])
    expect(buckets.scheduled.map(t => t.id)).toEqual(['later'])
    expect(buckets.done.map(t => t.id)).toEqual(['done1'])
  })
})

describe('project assembly', () => {
  const goals: GoalsSnapshot = {
    title: 'august',
    updated: '2026-08-11T12:00:00-03:00',
    goals: [
      { key: 'cut', title: 'cut, take two', meters: [{ label: 'weight', text: '65', ok: false }] },
      { key: 'defiant', title: 'defiant prep', meters: [] },
    ],
  }
  const registry: ProjectsSnapshot = {
    updated: '2026-08-11T12:00:00-03:00',
    projects: [
      { slug: 'iwa', title: 'iwa ceramics', status: 'active', note: 'kiln drop' },
      { slug: 'cut', title: 'dup of goal', status: 'active' },
      { slug: 'paused-proj', title: 'paused thing', status: 'paused' },
    ],
  }
  const todos = [
    todo({ id: 't1', project: 'cut' }),
    todo({ id: 't2', project: 'stray' }),
    todo({ id: 't3', project: 'iwa', kind: 'daily' }),
  ]
  const byProject = itemsByProject(todos)

  it('maps only global todos into project buckets', () => {
    expect(Object.keys(byProject).sort()).toEqual(['cut', 'stray'])
  })

  it('shows goal cards with meters or items only', () => {
    const cards = monthCards(goals, byProject)
    expect(cards.map(c => c.key)).toEqual(['cut'])
  })

  it('counts meters behind pace', () => {
    expect(behindCount(goals)).toBe(1)
  })

  it('orders projects active, untracked, paused and drops goal slugs', () => {
    const cards = projectCards(goals, registry, byProject)
    expect(cards.map(c => c.key)).toEqual(['iwa', 'stray', 'paused-proj'])
    expect(cards.find(c => c.key === 'stray')!.untracked).toBe(true)
  })

  it('collects known project slugs across goals, registry and todos', () => {
    expect(knownProjects(goals, registry, todos)).toEqual(['cut', 'defiant', 'iwa', 'paused-proj', 'stray'])
  })
})
