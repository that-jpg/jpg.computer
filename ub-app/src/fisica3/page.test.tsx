import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Fisica3Snapshot } from '../shared/types'
import { Fisica3Page } from './Fisica3Page'

const fixturePath = resolve(process.cwd(), 'src/fisica3/snapshot.fixture.json')
const snapshot: Fisica3Snapshot | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.setItem('ub-token', 'f'.repeat(64))
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ fisica3: snapshot }),
  })))
})

it.runIf(Boolean(snapshot))('renders the real snapshot end to end', async () => {
  const snap = snapshot!
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<Fisica3Page />)
  })
  await act(async () => {})

  const total = snap.chapters.reduce((sum, ch) => sum + ch.max - (ch.stupid ?? []).length, 0)
  const solved = snap.chapters.reduce((sum, ch) => sum + ch.solved.length, 0)
  const wrong = snap.chapters.reduce((sum, ch) => sum + (ch.wrong ?? []).length, 0)
  const pct = (100 * solved / total).toFixed(1)

  expect(container.querySelector('#total')!.textContent).toBe(`${solved} / ${total} solved${wrong ? ` · ${wrong} to redo` : ''}`)
  expect(container.querySelector('#pct')!.textContent).toBe(`${pct}%`)
  expect(document.title).toBe(`ub física 3 · ${pct}%`)
  expect(container.querySelectorAll('#chapters .chapter').length).toBe(snap.chapters.length)
  expect(container.querySelectorAll('#chapters .cell.solved').length).toBe(solved)
  expect(container.querySelectorAll('#chapters .cell.wrong').length).toBe(wrong)
  expect(container.querySelectorAll('#chapters .cell').length).toBe(snap.chapters.reduce((sum, ch) => sum + ch.max, 0))
  expect(container.querySelector('#next-up')!.textContent).toContain(`next up: ch ${snap.next_up}`)
  expect(container.querySelector('#as-of')!.textContent).toMatch(/as of /)
  expect(container.querySelector('#status')!.textContent).toBe('')
  if (!snap.has_dates) {
    expect(container.querySelector('#no-dates')).not.toBeNull()
  }
})

it.runIf(Boolean(snapshot))('paints wrong items red and counts them as redo', async () => {
  const snap = JSON.parse(JSON.stringify(snapshot)) as Fisica3Snapshot
  const first = snap.chapters[0]
  first.solved = [1, 2, 3]
  first.wrong = [2, 3]
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ fisica3: snap }) })))
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<Fisica3Page />)
  })
  await act(async () => {})

  const cells = container.querySelectorAll('#chapters .chapter:first-child .cell.wrong')
  expect(cells.length).toBe(2)
  expect(cells[0].classList.contains('solved')).toBe(true)
  expect(cells[0].getAttribute('title')).toBe('1.2 — wrong')
  expect(container.querySelector('#chapters .chapter:first-child .redo')!.textContent).toBe('· 2 to redo')
  expect(container.querySelector('#total')!.textContent).toMatch(/ · 2 to redo$/)
})

it.runIf(Boolean(snapshot))('paints stupid items grey, drops them from the totals, keeps them in the grid', async () => {
  const snap = JSON.parse(JSON.stringify(snapshot)) as Fisica3Snapshot
  const first = snap.chapters[0]
  first.solved = [1, 2]
  first.wrong = []
  first.stupid = [3, 4, 5]
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ fisica3: snap }) })))
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<Fisica3Page />)
  })
  await act(async () => {})

  const chapter = container.querySelector('#chapters .chapter:first-child')!
  const cells = chapter.querySelectorAll('.cell.stupid')
  expect(cells.length).toBe(3)
  expect(cells[0].getAttribute('title')).toBe('1.3 — stupid — skipped')
  expect(chapter.querySelectorAll('.cell').length).toBe(first.max)
  expect(chapter.querySelector('.tally')!.textContent).toBe(`2/${first.max - 3}`)
  expect(chapter.querySelector('.stupid-count')!.textContent).toBe('· 3 stupid')
  const total = snap.chapters.reduce((sum, ch) => sum + ch.max - (ch.stupid ?? []).length, 0)
  expect(container.querySelector('#total')!.textContent).toBe(`2 / ${total} solved · 3 stupid`)
})

it('redirects to /ub/ without a token', async () => {
  localStorage.removeItem('ub-token')
  const redirect = vi.fn()
  vi.stubGlobal('location', { href: '', assign: redirect })
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<Fisica3Page />)
  })
  await act(async () => {})
  expect((location as unknown as { href: string }).href).toBe('/ub/')
  expect(container.querySelectorAll('#chapters .chapter').length).toBe(0)
})
