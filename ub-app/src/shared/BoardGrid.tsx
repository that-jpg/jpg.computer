import type { ReactNode } from 'react'
import { COLUMNS, type CalCard, type Card, type Column, type Lane } from './board'
import { CardItem } from './CardItem'
import { usePressDrag } from './usePressDrag'

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

export const CAL_ID_PREFIX = 'cal:'

export function calDragId(card: CalCard): string {
  return `${CAL_ID_PREFIX}${card.date}|${card.key}`
}

export function CalCardItem({
  card,
  dragging,
  onDragStart,
}: {
  card: CalCard
  dragging?: boolean
  onDragStart?: (e: React.PointerEvent) => void
}) {
  const { onPress } = usePressDrag()
  const classes = [
    'card',
    'kind-event',
    card.state === 'done' ? 'done' : '',
    card.state === 'doing' ? 'doing' : '',
    card.ended && card.state !== 'done' ? 'event-past' : '',
    dragging ? 'dragging' : '',
    onDragStart ? 'draggable' : '',
  ].filter(Boolean).join(' ')
  return (
    <li className={classes} data-id={calDragId(card)} onPointerDown={onPress(onDragStart, () => {})}>
      <div className="card-line">
        <span className="todo-text">{card.ev.title}</span>
      </div>
      <div className="card-meta">
        {!card.ev.allDay && (
          <span className="event-time">{card.ev.start.slice(11, 16)}–{card.ev.end.slice(11, 16)}</span>
        )}
        {card.date && <span className="event-pill" style={{ background: card.color }}>{card.calLabel}</span>}
      </div>
    </li>
  )
}

export function CalendarRow({
  id = 'calendar',
  label,
  lane,
  cells,
  columnsShown = COLUMNS,
  draggingId,
  hoverCell,
  startDrag,
}: {
  id?: string
  label: ReactNode
  lane: Lane
  cells: Record<Column, CalCard[]>
  columnsShown?: Column[]
  draggingId?: string | null
  hoverCell?: string | null
  startDrag?: (id: string) => (e: React.PointerEvent) => void
}) {
  return (
    <div className={`grid-row lane-${lane} calendar-row`} style={{ display: 'contents' }}>
      <div className="grid-row-label">{label}</div>
      {columnsShown.map(column => {
        if (column === 'backlog') return <div key={column} className="cell void" />
        const key = cellKey(id, column)
        return (
          <ul key={column} className={`cell item-list${hoverCell === key ? ' drop-target' : ''}`} data-cell={key}>
            {cells[column].map(card => (
              <CalCardItem
                key={`${card.date}|${card.key}`}
                card={card}
                dragging={draggingId === calDragId(card)}
                onDragStart={startDrag ? startDrag(calDragId(card)) : undefined}
              />
            ))}
          </ul>
        )
      })}
    </div>
  )
}

export function calendarCells(cards: CalCard[]): Record<Column, CalCard[]> {
  const cells: Record<Column, CalCard[]> = { backlog: [], todo: [], doing: [], done: [] }
  for (const card of cards) cells[card.state === 'done' ? 'done' : card.state === 'doing' ? 'doing' : 'todo'].push(card)
  return cells
}
