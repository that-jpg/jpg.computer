import type { Todo, TodoState } from './types'

export function kindOf(todo: Todo): 'daily' | 'global' {
  return todo.kind === 'daily' ? 'daily' : 'global'
}

export function stateOf(todo: Todo): TodoState {
  if (todo.state === 'doing' || todo.state === 'done') return todo.state
  return todo.done ? 'done' : 'todo'
}

export function nextStateOf(todo: Todo): TodoState {
  const state = stateOf(todo)
  return state === 'todo' ? 'doing' : state === 'doing' ? 'done' : 'todo'
}

export function localDate(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function isOverdue(todo: Todo, today: string): boolean {
  return Boolean(todo.due) && stateOf(todo) !== 'done' && todo.due! < today
}

export function shortDue(iso: string): string {
  return new Date(iso + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toLowerCase()
}

export function isDoneToday(todo: Todo, today: string): boolean {
  return todo.doneOn === today
}

export function itemsByProject(todos: Todo[]): Record<string, Todo[]> {
  const map: Record<string, Todo[]> = {}
  for (const t of todos) {
    if (t.project && kindOf(t) === 'global') {
      ;(map[t.project] = map[t.project] || []).push(t)
    }
  }
  return map
}

export function inboxOf(todos: Todo[], today: string): Todo[] {
  return todos.filter(t =>
    kindOf(t) === 'global'
    && stateOf(t) !== 'done'
    && !t.project
    && (!t.due || t.due > today),
  )
}

export interface CardBuckets {
  visible: Todo[]
  scheduled: Todo[]
  done: Todo[]
}

export function cardBuckets(items: Todo[], today: string): CardBuckets {
  const open = items.filter(t => stateOf(t) !== 'done')
  const done = items.filter(t => stateOf(t) === 'done')
  const byDue = (a: Todo, b: Todo) => (a.due! < b.due! ? -1 : 1)
  const overdue = open.filter(t => isOverdue(t, today)).sort(byDue)
  const upcoming = open.filter(t => t.due && !isOverdue(t, today)).sort(byDue)
  const undated = open.filter(t => !t.due)
  return {
    visible: [...overdue, ...upcoming.slice(0, 1), ...undated],
    scheduled: upcoming.slice(1),
    done,
  }
}
