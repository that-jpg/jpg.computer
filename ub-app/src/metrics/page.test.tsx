import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import type { FinanceSnapshot, FitnessSnapshot, FrenchSnapshot, VenturesSnapshot } from '../shared/types'
import { MetricsPage } from './MetricsPage'

interface Fixture {
  fitness: FitnessSnapshot | null
  french: FrenchSnapshot | null
  finance: FinanceSnapshot | null
  ventures: VenturesSnapshot | null
}

const fixturePath = resolve(process.cwd(), 'src/metrics/snapshot.fixture.json')
const fixture: Fixture | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.setItem('ub-token', 'f'.repeat(64))
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const action = new URL(String(input), 'http://x').searchParams.get('action')!
    const payload = { [action]: fixture?.[action as keyof Fixture] ?? null }
    return { ok: true, status: 200, json: async () => payload }
  }))
})

async function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<MetricsPage />)
  })
  await act(async () => {})
  return container
}

it.runIf(Boolean(fixture?.fitness))('renders the fitness charts from the real snapshot', async () => {
  const fx = fixture!
  const container = await mount()

  const weightPts = fx.fitness!.weight_series?.length ?? 0
  expect(container.querySelectorAll('#weight-chart circle')).toHaveLength(weightPts)
  const kcalDays = fx.fitness!.kcal_series?.length ?? 0
  const logged = (fx.fitness!.kcal_series ?? []).filter(d => d.in != null).length
  expect(container.querySelector('#kcal-note')!.textContent).toBe(`${logged}/${kcalDays} days logged`)
  expect(container.querySelectorAll('#kcal-chart path')).toHaveLength(logged)
  expect(container.querySelectorAll('#kcal-table tr')).toHaveLength(kcalDays + 1)
  const weeks = fx.fitness!.training_weeks ?? []
  expect(container.querySelector('#training-note')!.textContent).toBe(
    `this week ${weeks[weeks.length - 1].sessions}`,
  )
})

it.runIf(Boolean(fixture?.french))('renders the french tiles and charts', async () => {
  const fx = fixture!
  const container = await mount()
  const vocab = fx.french!.vocab!
  expect(container.querySelector('#vocab-known')!.textContent).toBe(`${vocab.known} / ${vocab.total}`)
  expect(container.querySelector('#french-today')!.textContent).toBe(String(fx.french!.today.reviews))
  expect(container.querySelector('#accuracy-note')!.textContent).toMatch(/^now \d+%$/)
})

it.runIf(Boolean(fixture?.ventures))('renders ventures with pace gap and ledger tiles', async () => {
  const fx = fixture!
  const container = await mount()
  const s = fx.ventures!.stolas!
  const last = s.followers![s.followers!.length - 1]
  expect(container.querySelector('#followers-note')!.textContent).toBe(
    `${last.count} now · pace ${s.pace_today}`,
  )
  const b = fx.ventures!.brand_of_gods
  if (b && b.rows) {
    expect(container.querySelector('#bog-note')!.textContent).toContain(`${b.rows} rows`)
    expect(container.querySelectorAll('#bog-tiles > div').length).toBeGreaterThan(0)
  }
})

it('shows empty notes when every snapshot is missing', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const action = new URL(String(input), 'http://x').searchParams.get('action')!
    return { ok: true, status: 200, json: async () => ({ [action]: null }) }
  }))
  const container = await mount()
  expect(container.querySelector('#fitness-empty')).not.toBeNull()
  expect(container.querySelector('#french-empty')).not.toBeNull()
  expect(container.querySelector('#finance-empty')).not.toBeNull()
  expect(container.querySelector('#ventures-empty')).not.toBeNull()
})
