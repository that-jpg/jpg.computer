import { isOverdue, kindGlyph, nextColumn, shortDate, type Card } from './board'

export interface CardItemProps {
  card: Card
  today: string
  stale?: boolean
  dragging?: boolean
  onDragStart?: (e: React.PointerEvent) => void
  onCycle: (card: Card) => void
  onOpen: (card: Card) => void
}

export function CardItem({ card, today, stale, dragging, onDragStart, onCycle, onOpen }: CardItemProps) {
  const auto = card.kind === 'auto-routine'
  const done = card.column === 'done'
  const classes = [
    'card',
    done ? 'done' : '',
    card.column === 'doing' ? 'doing' : '',
    isOverdue(card, today) ? 'overdue' : '',
    card.kind !== 'task' ? `kind-${card.kind}` : '',
    stale ? 'stale' : '',
    dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')
  const checked = card.checklist.filter(c => c.done).length
  const glyph = kindGlyph(card.kind)

  return (
    <li className={classes} data-id={card.id}>
      {onDragStart && !auto && (
        <button className="todo-handle" aria-label="Move card" onPointerDown={onDragStart}>≡</button>
      )}
      {auto ? (
        <span className="habit-mark" aria-label={done ? 'signal seen' : 'no signal yet'}>{done ? '◆' : '◇'}</span>
      ) : (
        <button
          className="todo-toggle"
          aria-label={`Mark as ${nextColumn(card.column)}`}
          onClick={() => onCycle(card)}
        />
      )}
      {glyph && !auto && <span className="card-glyph">{glyph}</span>}
      <div className="card-body" onClick={() => onOpen(card)}>
        <span className="todo-text">{card.text}</span>
        {(card.key || card.checklist.length > 0 || (card.kind === 'task' && card.date && !done)) && (
          <span className="card-meta">
            {card.key && <span className="card-key">{card.key}</span>}
            {card.kind === 'task' && card.date && !done && <span className="due-chip">{shortDate(card.date)}</span>}
            {card.kind === 'task' && card.expires && !done && <span className="due-chip exp">exp</span>}
            {card.checklist.length > 0 && <span className="card-check">{checked}/{card.checklist.length}</span>}
          </span>
        )}
      </div>
    </li>
  )
}
