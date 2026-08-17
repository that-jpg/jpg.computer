import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import type { GoalsSnapshot } from '../shared/types'
import { MonthSection } from './MonthSection'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

async function render(goals: GoalsSnapshot | null | undefined) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(<MonthSection goals={goals} />)
  })
  return container
}

const goals: GoalsSnapshot = {
  title: 'august',
  updated: '2026-08-17T09:42:11-03:00',
  goals: [
    {
      key: 'fitness',
      title: 'cut to 63.6kg',
      meters: [
        { key: 'weight', label: 'weight', text: '65.1', pct: 40, pace_pct: 55, ok: false },
        { key: 'deficit', label: 'deficit', text: '-1500', pct: 80, pace_pct: 70, ok: true },
      ],
    },
    { key: 'french', title: 'french streak', meters: [] },
  ],
}

it('renders one row per goal with meters and counts those behind pace', async () => {
  const container = await render(goals)

  expect(container.querySelector('#month-section')).not.toBeNull()
  expect(container.querySelector('#month-title')!.textContent).toContain('august — ')
  expect(container.querySelector('#month-title .behind')!.textContent).toBe('1 behind pace')
  expect(container.querySelectorAll('.month-goal')).toHaveLength(1)
  expect(container.querySelector('.month-goal .mg-title')!.textContent).toBe('cut to 63.6kg')
  expect(container.querySelectorAll('.month-goal .goal-meter')).toHaveLength(2)
  expect(container.querySelector('#month-updated')!.textContent).toBe('as of 09:42')
  expect(container.querySelector('.month-empty')).toBeNull()
})

it('shows nothing while loading and "no goals set" for an empty snapshot', async () => {
  const loading = await render(undefined)
  expect(loading.querySelector('#month-section')).toBeNull()

  const empty = await render(null)
  expect(empty.querySelector('#month-title')!.textContent).toContain('on pace')
  expect(empty.querySelector('.month-empty')!.textContent).toBe('no goals set')
  expect(empty.querySelectorAll('.month-goal')).toHaveLength(0)
})
