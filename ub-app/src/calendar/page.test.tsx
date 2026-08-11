import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import type { CalendarSnapshot } from '../shared/types'
import { CalendarPage } from './CalendarPage'
import { addDays, alldayFor, fd, mondayOf, pd, timedFor, visibleEvents } from './logic'

const fixturePath = resolve(process.cwd(), 'src/calendar/snapshot.fixture.json')
const snapshot: CalendarSnapshot | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.setItem('ub-token', 'f'.repeat(64))
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ calendar: snapshot }),
  })))
})

async function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<CalendarPage />)
  })
  await act(async () => {})
  return container
}

it.runIf(Boolean(snapshot))('renders the real snapshot as a week grid', async () => {
  const snap = snapshot!
  window.innerWidth = 1024
  const container = await mount()

  const days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(pd(fd(new Date()))), i))
  const events = visibleEvents(snap, new Set())
  const expectedTimed = days.reduce((sum, d) => sum + timedFor(events, d).length, 0)
  const expectedAllday = days.reduce((sum, d) => sum + alldayFor(events, fd(d)).length, 0)

  expect(container.querySelectorAll('.head-cell')).toHaveLength(7)
  expect(container.querySelectorAll('.day-col')).toHaveLength(7)
  expect(container.querySelectorAll('.event')).toHaveLength(expectedTimed)
  expect(container.querySelectorAll('.allday-chip')).toHaveLength(expectedAllday)
  expect(container.querySelectorAll('.legend-item')).toHaveLength(snap.calendars.length)
  expect(container.querySelector('#as-of')!.textContent).toMatch(/as of /)
  expect(container.querySelector('#range-label')!.textContent).toMatch(/\w+ \d+ – \w+ \d+/)
})

it.runIf(Boolean(snapshot))('hides a calendar when its legend item is clicked', async () => {
  const snap = snapshot!
  window.innerWidth = 1024
  const container = await mount()

  const countedCal = snap.calendars.find(c => snap.events.some(ev => ev.cal === c.id))!
  const item = [...container.querySelectorAll('.legend-item')]
    .find(el => el.textContent === countedCal.name) as HTMLElement
  const before = container.querySelectorAll('.event, .allday-chip').length
  await act(async () => {
    item.click()
  })
  expect(item.className).toContain('off')
  expect(container.querySelectorAll('.event, .allday-chip').length).toBeLessThanOrEqual(before)
})

it('shows the empty-state status without a snapshot', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ calendar: null }),
  })))
  const container = await mount()
  expect(container.querySelector('#status')!.textContent).toBe(
    'no calendar snapshot yet — waiting for the first push from aiur',
  )
})
