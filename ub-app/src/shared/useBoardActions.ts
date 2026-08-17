import { useCallback, useRef } from 'react'
import { apiFetch, UnauthorizedError } from './api'
import { inToday, type CalCard, type Card, type Column } from './board'
import { CAL_ID_PREFIX, calDragId, parseCellKey, type GridRow } from './BoardGrid'
import type { CardPatch } from './CardPanel'
import type { DropResult } from './useCardDrag'
import type { useBoard } from './useBoard'

type Board = ReturnType<typeof useBoard>

export interface AddInput {
  text: string
  project?: string | null
  date?: string | null
  column?: Column
}

function optimisticPatch(card: Card, patch: CardPatch, today: string): Card {
  const next: Card = { ...card, ...patch } as Card
  if (patch.column !== undefined && patch.column !== card.column) {
    if (patch.column === 'done') {
      next.doneOn = today
      next.doneVia = 'tap'
    } else if (card.column === 'done') {
      next.doneOn = null
      next.doneVia = null
    }
    if (patch.column === 'doing' && !next.date) next.date = today
    if (patch.column === 'backlog') next.date = null
  }
  if (patch.date && next.column === 'backlog') next.column = 'todo'
  if (patch.project !== undefined && card.project === null && patch.project && next.column !== 'done') {
    next.column = 'todo'
  }
  return next
}

export function useBoardActions(board: Board, today: string, onUnauthorized: () => void) {
  const { mutateCards, setCalendarDone, setStatus, markMutated } = board
  const cycleCalRef = useRef<(card: CalCard, next: 'todo' | 'doing' | 'done') => Promise<void>>(async () => {})

  const patch = useCallback(
    (card: Card, fields: CardPatch) =>
      mutateCards(
        'cards',
        { method: 'PATCH', body: JSON.stringify({ id: card.id, ...fields }) },
        prev => prev.map(c => (c.id === card.id ? optimisticPatch(c, fields, today) : c)),
      ),
    [mutateCards, today],
  )

  const remove = useCallback(
    (card: Card) =>
      mutateCards(
        `cards&id=${encodeURIComponent(card.id)}`,
        { method: 'DELETE' },
        prev => prev.filter(c => c.id !== card.id),
      ),
    [mutateCards],
  )

  const add = useCallback(
    (input: AddInput) => {
      const text = input.text.replace(/\s+/g, ' ').trim()
      if (!text) return Promise.resolve(null)
      const project = input.project ?? null
      const date = project ? (input.date ?? null) : null
      const column: Column = project && !date && input.column === 'backlog' ? 'backlog' : 'todo'
      const pending: Card = {
        id: `pending-${Date.now()}`,
        text,
        kind: 'task',
        project,
        column,
        date,
        expires: false,
        key: null,
        description: '',
        checklist: [],
        template: null,
        signal: null,
        order: -1e9,
        todayOrder: null,
        created: Date.now(),
        doneOn: null,
        doneVia: null,
        journaled: false,
      }
      return mutateCards(
        'cards',
        { method: 'POST', body: JSON.stringify({ text, project, date, column }) },
        prev => [pending, ...prev],
      )
    },
    [mutateCards],
  )

  const dropCal = useCallback(
    async (result: DropResult, calCards: CalCard[]) => {
      const target = parseCellKey(result.cellKey)
      if (!target || target.column === 'backlog') return
      const card = calCards.find(c => calDragId(c) === result.id)
      if (!card || card.state === target.column) return
      await cycleCalRef.current(card, target.column)
    },
    [],
  )

  const drop = useCallback(
    async (result: DropResult, rows: GridRow[], calCards: CalCard[] = []) => {
      if (result.id.startsWith(CAL_ID_PREFIX)) return dropCal(result, calCards)
      const target = parseCellKey(result.cellKey)
      if (!target || !board.data) return
      const row = rows.find(r => r.id === target.rowId)
      const card = board.data.cards.find(c => c.id === result.id)
      if (!row || !card || row.project !== card.project) return
      const column = target.column
      const fields: CardPatch = {}
      if (card.kind === 'task') {
        const wasToday = inToday(card, today)
        if (row.lane === 'today' && !wasToday && column !== 'done' && card.date) fields.date = today
        if (row.lane === 'later' && wasToday && column === 'todo' && card.date) fields.date = null
      }
      if (column !== card.column) fields.column = column
      if (Object.keys(fields).length) await patch(card, fields)
      const ordered = result.ids
      if (row.lane === 'today') {
        await mutateCards(
          'today-order',
          { method: 'PUT', body: JSON.stringify({ order: ordered }) },
          prev => prev.map(c => (ordered.includes(c.id) ? { ...c, todayOrder: ordered.indexOf(c.id) } : c)),
        )
      } else {
        await mutateCards(
          'cards-order',
          { method: 'PUT', body: JSON.stringify({ project: row.project, column, order: ordered }) },
          prev => prev.map(c => (ordered.includes(c.id) ? { ...c, order: ordered.indexOf(c.id) } : c)),
        )
      }
    },
    [board.data, dropCal, mutateCards, patch, today],
  )

  const cycleCal = useCallback(
    async (card: CalCard, next: 'todo' | 'doing' | 'done') => {
      const date = card.date
      setCalendarDone(prev => {
        const day = { ...(prev[date] || {}) }
        if (next === 'todo') delete day[card.key]
        else day[card.key] = next
        return { ...prev, [date]: day }
      })
      markMutated()
      try {
        await apiFetch('calendar-done', {
          method: 'POST',
          body: JSON.stringify({ date, key: card.key, state: next }),
        })
        setStatus({ text: 'saved', error: false })
      } catch (e) {
        if (e instanceof UnauthorizedError) return onUnauthorized()
        setStatus({ text: 'sync failed - event state not saved', error: true })
      }
    },
    [markMutated, onUnauthorized, setCalendarDone, setStatus],
  )
  cycleCalRef.current = cycleCal

  return { patch, remove, add, drop, cycleCal }
}
