import { isOverdue, kindGlyph, shortDate, type Card } from './board'
import { usePressDrag } from './usePressDrag'

export interface CardItemProps {
  card: Card
  today: string
  stale?: boolean
  dragging?: boolean
  onDragStart?: (e: React.PointerEvent) => void
  onOpen: (card: Card) => void
}

export function CardItem({ card, today, stale, dragging, onDragStart, onOpen }: CardItemProps) {
  const { onPress } = usePressDrag()
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
    onDragStart ? 'draggable' : '',
  ].filter(Boolean).join(' ')
  const checked = card.checklist.filter(c => c.done).length
  const glyph = auto ? (done ? '◆' : '◇') : kindGlyph(card.kind)
  const meta = Boolean(card.key || card.checklist.length > 0 || (card.kind === 'task' && card.date && !done) || card.expires)

  return (
    <li
      className={classes}
      data-id={card.id}
      onPointerDown={onPress(onDragStart, () => onOpen(card))}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(card)
        }
      }}
    >
      <div className="card-line">
        {glyph && <span className={`card-glyph${auto ? ' habit-mark' : ''}`}>{glyph}</span>}
        <span className="todo-text">{card.text}</span>
      </div>
      {meta && (
        <div className="card-meta">
          {card.key && <span className="card-key">{card.key}</span>}
          {card.kind === 'task' && card.date && !done && <span className="due-chip">{shortDate(card.date)}</span>}
          {card.kind === 'task' && card.expires && !done && <span className="due-chip exp">exp</span>}
          {card.checklist.length > 0 && <span className="card-check">{checked}/{card.checklist.length}</span>}
        </div>
      )}
    </li>
  )
}
