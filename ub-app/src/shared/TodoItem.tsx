import { useState } from 'react'
import { isOverdue, localDate, shortDue, stateOf } from './todos'
import type { Todo, TodoState } from './types'

export interface TodoItemProps {
  todo: Todo
  stateOverride?: TodoState
  toggleLabel?: string
  withToday?: boolean
  withTag?: boolean
  knownProjects?: string[]
  dragging?: boolean
  onDragStart?: (e: React.PointerEvent) => void
  onCycle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onToday?: (todo: Todo) => void
  onProject?: (todo: Todo, project: string) => void
}

export function TodoItem({
  todo,
  stateOverride,
  toggleLabel,
  withToday,
  withTag,
  knownProjects = [],
  dragging,
  onDragStart,
  onCycle,
  onDelete,
  onToday,
  onProject,
}: TodoItemProps) {
  const [tagOpen, setTagOpen] = useState(false)
  const state = stateOverride ?? stateOf(todo)
  const nextState = state === 'todo' ? 'doing' : state === 'doing' ? 'done' : 'todo'
  const classes = [
    state === 'done' ? 'done' : '',
    state === 'doing' ? 'doing' : '',
    isOverdue(todo, localDate()) ? 'overdue' : '',
    dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')

  return (
    <li className={classes || undefined} data-id={todo.id}>
      {onDragStart && (
        <button className="todo-handle" aria-label="Reorder todo" onPointerDown={onDragStart}>
          ≡
        </button>
      )}
      <button className="todo-toggle" aria-label={toggleLabel ?? `Mark as ${nextState}`} onClick={() => onCycle(todo)} />
      <span className="todo-text">{todo.text}</span>
      {todo.due && <span className="due-chip">{shortDue(todo.due)}</span>}
      {withToday && (
        <button className="todo-today" aria-label="Due today" onClick={() => onToday?.(todo)}>
          today
        </button>
      )}
      {withTag && (
        tagOpen ? (
          <select
            className="tag-select"
            autoFocus
            onChange={e => {
              if (!e.target.value) return
              setTagOpen(false)
              onProject?.(todo, e.target.value)
            }}
            onBlur={() => setTagOpen(false)}
          >
            <option value="">project…</option>
            {knownProjects.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <button className="todo-tag" aria-label="Assign to project" onClick={() => setTagOpen(true)}>
            #
          </button>
        )
      )}
      <button className="todo-delete" aria-label="Delete todo" onClick={() => onDelete(todo)}>
        ×
      </button>
    </li>
  )
}
