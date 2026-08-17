import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AllPayload, Card } from '../shared/board'
import { AllPage } from './AllPage'
import { BoardPage } from '../board/BoardPage'
import { BoardsPage } from '../boards/BoardsPage'

const TODAY = new Date().toLocaleDateString('en-CA')

function card(over: Partial<Card> & { id: string; text: string }): Card {
  return {
    kind: 'task',
    project: 'iwa',
    column: 'todo',
    date: null,
    expires: false,
    key: null,
    description: '',
    checklist: [],
    template: null,
    signal: null,
    order: 0,
    todayOrder: null,
    created: 1,
    doneOn: null,
    doneVia: null,
    journaled: false,
    ...over,
  }
}

export function payload(): AllPayload {
  return {
    today: TODAY,
    now: new Date().toISOString(),
    cards: [
      card({ id: 'k1', text: 'kiln pickup', key: 'IWA-1', date: TODAY }),
      card({ id: 'k2', text: 'glaze', key: 'IWA-2', column: 'backlog' }),
      card({ id: 'k3', text: 'outreach draft', key: 'DEF-1', project: 'defiant', column: 'doing', date: TODAY }),
      card({ id: 'r1', text: 'anki', kind: 'routine', project: 'french', date: TODAY, template: 't1' }),
      card({ id: 'a1', text: 'food logged', kind: 'auto-routine', project: 'fitness', date: TODAY, template: 't2', signal: 'food', column: 'done', doneOn: TODAY, doneVia: 'signal' }),
      card({ id: 'i1', text: 'email: renew passport', project: null }),
      card({ id: 'd1', text: 'done thing', column: 'done', doneOn: TODAY, key: 'IWA-3' }),
    ],
    registry: {
      updated: null,
      lastRollover: TODAY,
      away: [],
      projects: [
        { slug: 'fitness', title: 'fitness', prefix: 'FIT', note: '', status: 'active', order: 0, counter: 0, templates: [{ id: 't2', title: 'food logged', kind: 'auto-routine', rule: { type: 'daily' }, whileAway: false, signal: 'food', mode: 'always' }] },
        { slug: 'french', title: 'french', prefix: 'FRE', note: '', status: 'active', order: 1, counter: 0, templates: [{ id: 't1', title: 'anki', kind: 'routine', rule: { type: 'daily' }, whileAway: false, signal: null, mode: null }] },
        { slug: 'iwa', title: 'iwa', prefix: 'IWA', note: 'cycle 1', status: 'active', order: 2, counter: 3, templates: [] },
        { slug: 'defiant', title: 'defiant', prefix: 'DEF', note: '', status: 'active', order: 3, counter: 1, templates: [] },
        { slug: 'home', title: 'home', prefix: 'HOME', note: '', status: 'paused', order: 4, counter: 0, templates: [] },
      ],
    },
    signals: { date: TODAY, updated: 'now' },
    weekGoals: { week: '2099-W01', goals: [{ id: 'g1', text: 'ship it', done: false }] },
    calendar: {
      generated: '',
      window: { start: TODAY, end: TODAY },
      calendars: [{ id: 'main', name: 'me@x', color: '#7bd148', primary: true }],
      events: [{ cal: 'main', title: 'standup', start: `${TODAY}T23:00:00`, end: `${TODAY}T23:30:00`, allDay: false }],
    },
    calendarDone: {},
    notes: { total: 10, week_daily_avg: 1.5 },
  }
}

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.setItem('ub-token', 'f'.repeat(64))
  vi.stubGlobal('innerWidth', 1200)
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const action = new URL(String(input), 'http://x').searchParams.get('action')!
    const data = payload()
    if (action === 'all') return { ok: true, status: 200, json: async () => data }
    if (action === 'cards' && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      const cards = data.cards.map(c => (c.id === body.id ? { ...c, ...body } : c))
      return { ok: true, status: 200, json: async () => ({ cards }) }
    }
    return { ok: true, status: 200, json: async () => ({ cards: data.cards, registry: data.registry }) }
  }))
})

async function mount(el: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(el)
  })
  await act(async () => {})
  return container
}

it('all-view renders strip, inbox, one lane per active board with cards, and the calendar row', async () => {
  const container = await mount(<AllPage />)
  expect(container.querySelector('#week-label')!.textContent).toBe('w01')
  expect(container.querySelectorAll('#inbox-list > li')).toHaveLength(1)
  const labels = [...container.querySelectorAll('.grid-row-label')].map(el => el.textContent)
  expect(labels).toEqual(['calendar', 'fitness', 'french', 'iwa', 'defiant'])
  expect(container.querySelector('#today-count')!.textContent).toBe('4 left')
  const iwaTodo = container.querySelector('[data-cell="iwa::todo"]')!
  expect(iwaTodo.textContent).toContain('kiln pickup')
  expect(iwaTodo.textContent).toContain('IWA-1')
  expect(container.querySelector('[data-cell="iwa::done"]')!.textContent).toContain('done thing')
  expect(container.querySelector('[data-cell="fitness::done"] .habit-mark')!.textContent).toBe('◆')
  expect(container.querySelector('[data-cell="defiant::doing"]')!.textContent).toContain('outreach draft')
  expect(container.querySelector('.calendar-row')!.textContent).toContain('standup')
  const quiet = [...container.querySelectorAll('#quiet-boards a')].map(a => a.textContent)
  expect(quiet).toEqual([])
})

it('all-view lists active boards without Today cards under the grid', async () => {
  const data = payload()
  data.registry.projects.push({ slug: 'work', title: 'work', prefix: 'WORK', note: '', status: 'active', order: -1, counter: 0, templates: [] })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => data })))
  const container = await mount(<AllPage />)
  const quiet = [...container.querySelectorAll('#quiet-boards a')].map(a => a.textContent)
  expect(quiet).toEqual(['work'])
  expect([...container.querySelectorAll('.grid-row-label')].map(el => el.textContent)).not.toContain('work')
})

it('all-view opens the card panel and patches on column click', async () => {
  const container = await mount(<AllPage />)
  const title = [...container.querySelectorAll('[data-cell="iwa::todo"] .todo-text')].find(el => el.textContent === 'kiln pickup') as HTMLElement
  await act(async () => { title.click() })
  const panel = container.querySelector('#card-panel')!
  expect((panel.querySelector('.panel-title') as HTMLInputElement).value).toBe('kiln pickup')
  const doneButton = [...panel.querySelectorAll('.panel-columns button')].find(b => b.textContent === 'done') as HTMLButtonElement
  await act(async () => { doneButton.click() })
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(c => String(c[0]).includes('action=cards'))
  expect(calls.length).toBe(1)
  expect(JSON.parse(String(calls[0][1].body))).toEqual({ id: 'k1', column: 'done' })
})

it('board page renders today and later lanes for its slug with header chrome', async () => {
  const container = await mount(<BoardPage slug="iwa" />)
  expect(container.querySelector('h1')!.textContent).toContain('iwa')
  expect(container.querySelector('.board-prefix')!.textContent).toBe('IWA')
  expect(container.querySelector('.board-note')!.textContent).toBe('cycle 1')
  expect(container.querySelector('.board-count')!.textContent).toBe('2 open')
  expect(container.querySelector('[data-cell="today::todo"]')!.textContent).toContain('kiln pickup')
  expect(container.querySelector('[data-cell="later::backlog"]')!.textContent).toContain('glaze')
  expect(container.querySelector('[data-cell="today::done"]')!.textContent).toContain('done thing')
  expect(container.querySelector('#templates-toggle')!.textContent).toBe('routines (0)')
})

it('boards page lists every board with status and the calendar row', async () => {
  const container = await mount(<BoardsPage />)
  const rows = [...container.querySelectorAll('#boards-list .board-row')]
  expect(rows).toHaveLength(6)
  expect(rows[0].textContent).toContain('calendar')
  expect(rows[1].querySelector('.board-title')!.textContent).toBe('fitness')
  expect((rows[5].querySelector('select') as HTMLSelectElement).value).toBe('paused')
})
