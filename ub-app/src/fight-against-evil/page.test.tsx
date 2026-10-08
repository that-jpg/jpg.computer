import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Fisica3Snapshot } from '../shared/types'
import { FightPage } from './FightPage'
import type { SolutionsManifest } from './logic'

const fixturePath = resolve(process.cwd(), 'src/fisica3/snapshot.fixture.json')
const snapshot: Fisica3Snapshot | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

function stubFetch(snap: Fisica3Snapshot | null, manifest: SolutionsManifest | null, manifestStatus = 200) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('manifest.json')) {
      return { ok: manifestStatus === 200, status: manifestStatus, json: async () => manifest }
    }
    expect(String(url)).toBe('/api/ub?action=fisica3-public')
    return { ok: true, status: 200, json: async () => ({ fisica3: snap }) }
  }))
}

async function render() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<FightPage />)
  })
  await act(async () => {})
  return container
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('location', { pathname: '/fight-against-evil', search: '' })
})

it.runIf(Boolean(snapshot))('renders the public ledger with solution links, no login needed', async () => {
  const snap = snapshot!
  const first = snap.chapters[0]
  const linked = first.solved.filter(n => !(first.wrong ?? []).includes(n)).slice(0, 2)
  expect(linked.length).toBe(2)
  const flagged = (first.wrong ?? []).slice(0, 1)
  const manifest: SolutionsManifest = {
    updated: '2026-09-03T15:00:00-03:00',
    docs: [
      { id: `${first.ch}.${linked[0]}`, ch: first.ch, n: linked[0], attempt: 1, file: `${first.ch}.${linked[0]}-1.pdf`, reviewed: '2026-09-01T14:00:00-03:00', verdict: 'correct' },
      { id: `${first.ch}.${linked[1]}`, ch: first.ch, n: linked[1], attempt: 1, file: `${first.ch}.${linked[1]}-1.pdf`, reviewed: '2026-09-01T12:00:00-03:00', verdict: 'wrong' },
      { id: `${first.ch}.${linked[1]}`, ch: first.ch, n: linked[1], attempt: 2, file: `${first.ch}.${linked[1]}-2.pdf`, reviewed: '2026-09-02T14:00:00-03:00', verdict: 'correct' },
      ...flagged.map(n => ({ id: `${first.ch}.${n}`, ch: first.ch, n, attempt: 1, file: `${first.ch}.${n}-1.pdf`, reviewed: '2026-09-02T14:00:00-03:00', verdict: 'wrong' as const })),
    ],
  }
  stubFetch(snap, manifest)
  const container = await render()

  const total = snap.chapters.reduce((sum, ch) => sum + ch.max - (ch.stupid ?? []).length, 0)
  const solved = snap.chapters.reduce((sum, ch) => sum + ch.solved.length, 0)
  const pct = (100 * solved / total).toFixed(1)

  expect(container.querySelector('#total')!.textContent).toMatch(new RegExp(`^${solved} / ${total} solved`))
  expect(container.querySelector('#pct')!.textContent).toBe(`${pct}%`)
  expect(document.title).toBe(`fight against evil · ${pct}%`)
  expect(container.querySelectorAll('#chapters .chapter').length).toBe(snap.chapters.length)
  expect(container.querySelectorAll('#chapters .cell').length).toBe(snap.chapters.reduce((sum, ch) => sum + ch.max, 0))
  expect(container.querySelector('#status')!.textContent).toBe('')
  expect(container.querySelector('#docs-count')!.textContent).toContain(`${2 + flagged.length} reviewed solutions · ${3 + flagged.length} submissions`)

  const links = container.querySelectorAll<HTMLAnchorElement>('#chapters a.cell.doc')
  expect(links.length).toBe(1 + flagged.length)
  expect(links[0].getAttribute('href')).toBe(`/fight-against-evil/solutions/${first.ch}.${linked[0]}-1.pdf`)
  expect(links[0].classList.contains('solved')).toBe(true)
  expect(links[0].getAttribute('title')).toBe(`${first.ch}.${linked[0]} — solution reviewed as correct`)
  const wrongLinks = container.querySelectorAll<HTMLAnchorElement>('#chapters a.cell.doc.wrong')
  expect(wrongLinks.length).toBe(flagged.length)
  if (flagged.length) {
    expect(wrongLinks[0].getAttribute('href')).toBe(`/fight-against-evil/solutions/${first.ch}.${flagged[0]}-1.pdf`)
    expect(wrongLinks[0].getAttribute('title')).toBe(`${first.ch}.${flagged[0]} — wrong attempt, to redo`)
  }

  const menu = container.querySelector<HTMLButtonElement>('#chapters button.cell.doc')!
  expect(menu.textContent).toBe(String(linked[1]))
  expect(menu.getAttribute('title')).toBe(`${first.ch}.${linked[1]} — 2 submissions, latest correct`)
  expect(container.querySelector('.attempts')).toBeNull()
  await act(async () => { menu.click() })
  const attempts = container.querySelectorAll<HTMLAnchorElement>('.attempts a.attempt')
  expect(attempts.length).toBe(2)
  expect(attempts[0].getAttribute('href')).toBe(`/fight-against-evil/solutions/${first.ch}.${linked[1]}-1.pdf`)
  expect(attempts[0].classList.contains('wrong')).toBe(true)
  expect(attempts[1].classList.contains('correct')).toBe(true)
  await act(async () => { document.body.click() })
  expect(container.querySelector('.attempts')).toBeNull()
  expect(container.querySelector('#header-nav a')!.getAttribute('href')).toBe('/')
  expect(container.querySelector('#logout')).toBeNull()
})

it.runIf(Boolean(snapshot))('survives a missing manifest', async () => {
  stubFetch(snapshot, null, 404)
  const container = await render()
  expect(container.querySelectorAll('#chapters a.cell').length).toBe(0)
  expect(container.querySelector('#docs-count')!.textContent).toBe('')
  expect(container.querySelector('#status')!.textContent).toBe('')
})

it('reports a missing snapshot without redirecting', async () => {
  const assign = vi.fn()
  vi.stubGlobal('location', { href: '', pathname: '/fight-against-evil', search: '', assign })
  stubFetch(null, null, 404)
  const container = await render()
  expect(container.querySelector('#status')!.textContent).toBe('no snapshot yet')
  expect(container.querySelectorAll('#chapters .chapter').length).toBe(0)
  expect(assign).not.toHaveBeenCalled()
  expect(document.title).toBe('fight against evil')
})

it('stars exactly the suggested exercises across missing, solved and reviewed cells', async () => {
  const snap: Fisica3Snapshot = {
    updated: '2026-10-08T12:00:00-03:00', course: 'fisica3', book: 'Bauer',
    next_up: 1, fim: null, has_dates: false,
    chapters: Array.from({ length: 11 }, (_, i) => ({
      ch: i + 1, title: `Chapter ${i + 1}`, q_start: 11, p_start: 21, ad_start: 70, max: 90,
      solved: i === 0 ? [23, 31, 37] : [], wrong: i === 0 ? [31] : [], deadline: null, status: 'no_date',
    })),
  }
  stubFetch(snap, {
    updated: snap.updated,
    docs: [
      { id: '1.23', ch: 1, n: 23, attempt: 1, file: '1.23-1.pdf', reviewed: snap.updated, verdict: 'correct' },
      { id: '1.31', ch: 1, n: 31, attempt: 1, file: '1.31-1.pdf', reviewed: snap.updated, verdict: 'wrong' },
      { id: '1.31', ch: 1, n: 31, attempt: 2, file: '1.31-2.pdf', reviewed: snap.updated, verdict: 'wrong' },
    ],
  })
  const container = await render()
  const expected = `
    1.23 1.31 1.37 1.41 1.45 1.52 1.54 1.71 1.79 1.80
    2.27 2.28 2.32 2.33 2.41 2.43 2.45 2.46 2.71 2.74 2.76
    2.47 2.52 2.56 2.57 2.63 2.66 2.68 2.74 2.76 2.80 2.85
    3.42 3.44 3.47 3.48 3.51 3.56 3.61 3.70 3.78 3.79
    4.25 4.26 4.28 4.30 4.49 4.50 4.55 4.79 4.80 4.84
    6.24 6.27 6.31 6.32 6.40 6.41 6.42 6.51 6.62 6.67
  `.trim().split(/\s+/)
  const stars = container.querySelectorAll('#chapters .priority-star')
  expect(stars.length).toBe(60)
  expect([...stars].map(star => star.parentElement!.title.split(' — ')[0]).sort()).toEqual([...new Set(expected)].sort())
  for (const star of stars) {
    expect(star.textContent).toBe('★')
    expect(star.getAttribute('aria-label')).toBe('Priority')
  }
  expect(container.querySelector('#legend')!.textContent).toContain('★ priority')
  expect(container.querySelector('#total')!.textContent).toBe('3 / 990 solved · 1 to redo')
  expect(container.querySelector<HTMLAnchorElement>('a.cell:has(.priority-star)')!.getAttribute('href')).toBe('/fight-against-evil/solutions/1.23-1.pdf')
  const menu = container.querySelector<HTMLButtonElement>('button.cell:has(.priority-star)')!
  await act(async () => { menu.click() })
  expect(container.querySelectorAll('.attempts a')).toHaveLength(2)
})

it.each([
  ['/fight-against-evil/classroom', ''],
  ['/fight-against-evil/classroom/', '?user=jpg'],
  ['/fight-against-evil', '?tab=classroom'],
])('opens the classroom section at %s%s independently of the book', async (pathname, search) => {
  vi.stubGlobal('location', { pathname, search })
  vi.stubGlobal('fetch', vi.fn())
  const container = await render()

  expect(container.querySelector('#classroom-heading')!.textContent).toBe('Classroom exercises')
  expect(container.textContent).toContain('No classroom exercises added yet.')
  expect(container.querySelector('#chapters')).toBeNull()
  const current = container.querySelectorAll('.fight-tabs a[aria-current="page"]')
  expect(current.length).toBe(1)
  expect(current[0].getAttribute('href')).toBe('/fight-against-evil/classroom')
  expect(container.querySelector('.fight-tabs a[href="/fight-against-evil"]')).not.toBeNull()
  expect(document.title).toBe('Classroom exercises · fight against evil')
  expect(fetch).not.toHaveBeenCalled()
})
