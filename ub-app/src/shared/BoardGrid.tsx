import type { ReactNode } from 'react'
import { COLUMNS, type CalCard, type Card, type Column, type Lane } from './board'
import { CardItem } from './CardItem'

export interface GridRow {
  id: string
  label: ReactNode
  lane: Lane
  project: string | null
  columns: Column[]
  cells: Record<Column, Card[]>
  draggable: boolean
}

export interface CellDrop {
  row: GridRow
  column: Column
  ids: string[]
}

export const COLUMN_LABELS: Record<Column, string> = {
  backlog: 'backlog',
  todo: 'todo',
  doing: 'doing',
  done: 'done',
}

export function cellKey(rowId: string, column: Column): string {
  return `${rowId}::${column}`
}

export function parseCellKey(key: string): { rowId: string; column: Column } | null {
  const idx = key.lastIndexOf('::')
  if (idx < 0) return null
  const column = key.slice(idx + 2) as Column
  if (!COLUMNS.includes(column)) return null
  return { rowId: key.slice(0, idx), column }
}

export interface BoardGridProps {
  today: string
  rows: GridRow[]
  stale?: boolean
  draggingId: string | null
  hoverCell: string | null
  previewIds: string[] | null
  startDrag: (id: string) => (e: React.PointerEvent) => void
  onCycle: (card: Card) => void
  onOpen: (card: Card) => void
  extraRows?: ReactNode
  columnsShown?: Column[]
}

export function BoardGrid({
  today,
  rows,
  stale,
  draggingId,
  hoverCell,
  previewIds,
  startDrag,
  onCycle,
  onOpen,
  extraRows,
  columnsShown = COLUMNS,
}: BoardGridProps) {
  const allCards = new Map<string, Card>()
  for (const row of rows) for (const column of COLUMNS) for (const card of row.cells[column]) allCards.set(card.id, card)

  return (
    <div className="board-grid" style={{ gridTemplateColumns: `minmax(90px, 140px) repeat(${columnsShown.length}, minmax(0, 1fr))` }}>
      <div className="grid-corner" />
      {columnsShown.map(column => (
        <div key={column} className="grid-col-head">{COLUMN_LABELS[column]}</div>
      ))}
      {extraRows}
      {rows.map(row => (
        <div key={row.id} className={`grid-row lane-${row.lane}`} style={{ display: 'contents' }}>
          <div className="grid-row-label">{row.label}</div>
          {columnsShown.map(column => {
            if (!row.columns.includes(column)) return <div key={column} className="cell void" />
            const key = cellKey(row.id, column)
            const hovered = hoverCell === key
            const ids = hovered && previewIds ? previewIds : row.cells[column].map(c => c.id)
            const cards = ids.map(id => allCards.get(id)).filter((c): c is Card => Boolean(c))
            return (
              <ul key={column} className={`cell item-list${hovered ? ' drop-target' : ''}`} data-cell={key}>
                {cards.map(card => (
                  <CardItem
                    key={card.id}
                    card={card}
                    today={today}
                    stale={stale && card.kind === 'auto-routine'}
                    dragging={draggingId === card.id}
                    onDragStart={row.draggable && card.kind !== 'auto-routine' ? startDrag(card.id) : undefined}
                    onCycle={onCycle}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function CalCardItem({
  card,
  onCycle,
}: {
  card: CalCard
  onCycle: (card: CalCard, next: 'todo' | 'doing' | 'done') => void
}) {
  const next = card.state === 'todo' ? 'doing' : card.state === 'doing' ? 'done' : 'todo'
  const classes = [
    'card',
    'kind-event',
    card.state === 'done' ? 'done' : '',
    card.state === 'doing' ? 'doing' : '',
    card.ended && card.state !== 'done' ? 'event-past' : '',
  ].filter(Boolean).join(' ')
  return (
    <li className={classes} data-cal={card.key}>
      <button className="todo-toggle" aria-label={`Mark as ${next}`} onClick={() => onCycle(card, next)} />
      <span className="todo-text">{card.ev.title}</span>
      {!card.ev.allDay && (
        <span className="event-time">{card.ev.start.slice(11, 16)}–{card.ev.end.slice(11, 16)}</span>
      )}
      <span className="event-pill" style={{ background: card.color }}>{card.calLabel}</span>
    </li>
  )
}

export function CalendarRow({
  label,
  lane,
  cells,
  columnsShown = COLUMNS,
  onCycle,
}: {
  label: ReactNode
  lane: Lane
  cells: Record<Column, CalCard[]>
  columnsShown?: Column[]
  onCycle: (card: CalCard, next: 'todo' | 'doing' | 'done') => void
}) {
  return (
    <div className={`grid-row lane-${lane} calendar-row`} style={{ display: 'contents' }}>
      <div className="grid-row-label">{label}</div>
      {columnsShown.map(column => (
        column === 'backlog'
          ? <div key={column} className="cell void" />
          : (
            <ul key={column} className="cell item-list">
              {cells[column].map(card => <CalCardItem key={`${card.date}|${card.key}`} card={card} onCycle={onCycle} />)}
            </ul>
          )
      ))}
    </div>
  )
}

export function calendarCells(cards: CalCard[]): Record<Column, CalCard[]> {
  const cells: Record<Column, CalCard[]> = { backlog: [], todo: [], doing: [], done: [] }
  for (const card of cards) cells[card.state === 'done' ? 'done' : card.state === 'doing' ? 'doing' : 'todo'].push(card)
  return cells
}
