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
  vi.stubGlobal('location', { href: '', assign })
  stubFetch(null, null, 404)
  const container = await render()
  expect(container.querySelector('#status')!.textContent).toBe('no snapshot yet')
  expect(container.querySelectorAll('#chapters .chapter').length).toBe(0)
  expect(assign).not.toHaveBeenCalled()
  expect(document.title).toBe('fight against evil')
})
