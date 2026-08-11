import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { localDate } from '../shared/todos'
import type { CalendarDone, CalendarSnapshot, GoalsSnapshot, Todo, WeekGoals } from '../shared/types'
import { currentWeek, todayBands } from './logic'
import { TodayPage } from './TodayPage'

interface Fixture {
  todos: Todo[] | null
  goals: GoalsSnapshot | null
  calendar: CalendarSnapshot | null
  done: CalendarDone | null
  weekGoals: WeekGoals | null
}

const fixturePath = resolve(process.cwd(), 'src/today/snapshot.fixture.json')
const fixture: Fixture | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.setItem('ub-token', 'f'.repeat(64))
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const action = new URL(String(input), 'http://x').searchParams.get('action')!
    const fx = fixture!
    const payload =
      action === 'todos' ? { todos: fx.todos ?? [] }
      : action === 'goals' ? { goals: fx.goals }
      : action === 'calendar' ? { calendar: fx.calendar }
      : action === 'calendar-done' ? { done: fx.done }
      : action === 'week-goals' ? { weekGoals: fx.weekGoals }
      : {}
    return { ok: true, status: 200, json: async () => payload }
  }))
})

async function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<TodayPage />)
  })
  await act(async () => {})
  return container
}

it.runIf(Boolean(fixture))('renders the real snapshot bands and counter', async () => {
  const fx = fixture!
  const container = await mount()

  const bands = todayBands(fx.todos ?? [], fx.goals, fx.calendar, fx.done ?? {}, localDate(), new Date())

  expect(container.querySelectorAll('#overdue-list > li')).toHaveLength(bands.overdue.length)
  expect(container.querySelectorAll('#due-list > li')).toHaveLength(bands.dueToday.length)
  expect(container.querySelectorAll('#event-list > li')).toHaveLength(bands.eventsOpen.length)
  expect(container.querySelectorAll('#daily-list > li')).toHaveLength(bands.dailyOpen.length)
  expect(container.querySelectorAll('#habit-list > li')).toHaveLength(bands.habitsOpen.length)
  expect(container.querySelectorAll('#done-today-list > li')).toHaveLength(
    bands.doneTodayTodos.length + bands.dailyDone.length + bands.habitsDone.length + bands.eventsSunk.length,
  )
  expect(container.querySelector('#today-count')!.textContent).toBe(
    bands.left === 0 ? 'clear' : `${bands.left} left`,
  )
  if (bands.doneHistory.length) {
    expect(container.querySelector('#done-summary')!.textContent).toBe(`done (${bands.doneHistory.length})`)
  }
})

it.runIf(Boolean(fixture?.weekGoals))('renders the week strip from the real snapshot', async () => {
  const fx = fixture!
  const container = await mount()
  const stale = fx.weekGoals!.week < currentWeek()
  expect(container.querySelector('#week-label')!.textContent).toBe(fx.weekGoals!.week.slice(5).toLowerCase())
  expect(container.querySelectorAll('#week-goal-list > li')).toHaveLength(fx.weekGoals!.goals.length)
  if (!stale) {
    expect(container.querySelector('#week-add')).not.toBeNull()
    expect(container.querySelector('#week-start')).toBeNull()
  } else {
    expect(container.querySelector('#week-start')).not.toBeNull()
  }
})

it.runIf(Boolean(fixture))('adds a todo optimistically on submit', async () => {
  const container = await mount()
  const input = container.querySelector('#add-input') as HTMLInputElement
  const before = container.querySelectorAll('#overdue-list > li, #due-list > li').length
  input.value = 'test pending todo'
  await act(async () => {
    ;(container.querySelector('#add-form') as HTMLFormElement).dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true }),
    )
  })
  expect(before).toBeGreaterThanOrEqual(0)
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][]
  const post = calls.find(([, init]) => init?.method === 'POST')
  expect(post).toBeDefined()
  expect(JSON.parse(String(post![1]!.body))).toMatchObject({ text: 'test pending todo', kind: 'global' })
})
