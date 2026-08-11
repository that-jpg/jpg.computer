import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi, type Mock } from 'vitest'
import { inboxOf, itemsByProject, localDate } from '../shared/todos'
import type { GoalsSnapshot, ProjectsSnapshot, Todo } from '../shared/types'
import { behindCount, monthCards, projectCards } from './logic'
import { ProjectsPage } from './ProjectsPage'

interface Fixture {
  todos: Todo[] | null
  goals: GoalsSnapshot | null
  projects: ProjectsSnapshot | null
}

const fixturePath = resolve(process.cwd(), 'src/projects/snapshot.fixture.json')
const fixture: Fixture | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

function stubApi(fx: Fixture) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input)
    const action = new URL(url, 'http://x').searchParams.get('action')
    const payload =
      action === 'todos' ? { todos: fx.todos ?? [] }
      : action === 'goals' ? { goals: fx.goals }
      : action === 'projects' ? { projects: fx.projects }
      : {}
    return { ok: true, status: 200, json: async () => payload }
  }))
}

beforeEach(() => {
  localStorage.setItem('ub-token', 'f'.repeat(64))
})

async function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<ProjectsPage />)
  })
  await act(async () => {})
  return container
}

it.runIf(Boolean(fixture))('renders the real snapshot: goal cards, projects, inbox', async () => {
  const fx = fixture!
  stubApi(fx)
  const container = await mount()

  const todos = fx.todos ?? []
  const byProject = itemsByProject(todos)
  const goalCards = monthCards(fx.goals, byProject)
  const projects = projectCards(fx.goals, fx.projects, byProject)
  const inbox = inboxOf(todos, localDate())
  const behind = behindCount(fx.goals)

  expect(container.querySelectorAll('#goal-cards .goal-card')).toHaveLength(goalCards.length)
  expect(container.querySelectorAll('#project-cards .goal-card')).toHaveLength(projects.length)
  expect(container.querySelectorAll('#inbox-list > li')).toHaveLength(inbox.length)
  expect(container.querySelector('#month-title')!.textContent).toContain(
    behind > 0 ? `${behind} behind pace` : 'on pace',
  )
  if (inbox.length) {
    expect(container.querySelector('#inbox-count')!.textContent).toBe(`${inbox.length} unsorted`)
    expect(container.querySelector('#unsorted-link')!.textContent).toBe(`${inbox.length} unsorted ↓`)
  }
  expect(container.querySelector('#logout')!.className).not.toContain('hidden')
})

it.runIf(Boolean(fixture))('cycling a todo sends a PATCH with the next state', async () => {
  const fx = fixture!
  stubApi(fx)
  const container = await mount()

  const firstToggle = container.querySelector('#inbox-list .todo-toggle') as HTMLButtonElement | null
  if (!firstToggle) return
  await act(async () => {
    firstToggle.click()
  })
  const calls = (fetch as unknown as Mock).mock.calls as [string, RequestInit?][]
  const patch = calls.find(([, init]) => init?.method === 'PATCH')
  expect(patch).toBeDefined()
  expect(JSON.parse(String(patch![1]!.body))).toMatchObject({ state: 'doing' })
})

it('shows the login form without a token', async () => {
  localStorage.removeItem('ub-token')
  stubApi({ todos: [], goals: null, projects: null })
  const container = await mount()
  expect(container.querySelector('#login-view')).not.toBeNull()
  expect(container.querySelector('#app-view')).toBeNull()
})
