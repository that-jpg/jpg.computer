import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, clearToken, getToken } from '../shared/api'
import { HeaderNav } from '../shared/HeaderNav'
import { LoginForm } from '../shared/LoginForm'
import { TodoItem } from '../shared/TodoItem'
import { cardBuckets, inboxOf, itemsByProject, localDate, nextStateOf, stateOf } from '../shared/todos'
import type { GoalsSnapshot, Meter, ProjectsSnapshot, Todo } from '../shared/types'
import { useDragReorder } from '../shared/useDragReorder'
import { useTodos } from '../shared/useTodos'
import { behindCount, knownProjects, monthCards, projectCards, type Card } from './logic'

function MeterBar({ m }: { m: Meter }) {
  return (
    <div className={`goal-meter${m.ok === false ? ' gm-bad' : ''}`}>
      <div className="gm-head">
        <span>{m.label}</span>
        <span className="gm-text">{m.text}</span>
      </div>
      <div className="gm-bar">
        <div className="gm-fill" style={{ width: `${Math.max(0, Math.min(100, m.pct || 0))}%` }} />
        {m.pace_pct != null && m.pace_pct > 0 && (
          <div className="gm-tick" style={{ left: `calc(${Math.min(m.pace_pct, 100)}% - 1px)` }} />
        )}
      </div>
    </div>
  )
}

interface TodoHandlers {
  onCycle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onToday: (todo: Todo) => void
}

function FoldList({ label, items, handlers }: { label: string; items: Todo[]; handlers: TodoHandlers }) {
  return (
    <details>
      <summary>{label}</summary>
      <ul>
        {items.map(t => (
          <TodoItem key={t.id} todo={t} onCycle={handlers.onCycle} onDelete={handlers.onDelete} />
        ))}
      </ul>
    </details>
  )
}

function CardAdd({ onAdd }: { onAdd: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <form
      className="card-add"
      onSubmit={e => {
        e.preventDefault()
        const text = inputRef.current!.value.trim()
        if (!text) return
        inputRef.current!.value = ''
        onAdd(text)
      }}
    >
      <input ref={inputRef} placeholder="+ add" maxLength={500} autoComplete="off" />
    </form>
  )
}

function CardHead({ card }: { card: Card }) {
  const doneCount = card.items.filter(t => stateOf(t) === 'done').length
  return (
    <div className="goal-head">
      <span className="goal-name">
        {card.title}
        {card.untracked && <span className="untracked"> · untracked</span>}
      </span>
      {card.items.length > 0 && (
        <span className="goal-count">{doneCount}/{card.items.length}</span>
      )}
    </div>
  )
}

function CardBody({ card, handlers, onAdd }: { card: Card; handlers: TodoHandlers; onAdd: (text: string) => void }) {
  const buckets = cardBuckets(card.items, localDate())
  return (
    <>
      {card.meters.map((m, i) => <MeterBar key={i} m={m} />)}
      {buckets.visible.length > 0 && (
        <ul>
          {buckets.visible.map(t => (
            <TodoItem
              key={t.id}
              todo={t}
              withToday={!t.due}
              onCycle={handlers.onCycle}
              onDelete={handlers.onDelete}
              onToday={handlers.onToday}
            />
          ))}
        </ul>
      )}
      {buckets.scheduled.length > 0 && (
        <FoldList label={`+${buckets.scheduled.length} scheduled`} items={buckets.scheduled} handlers={handlers} />
      )}
      {buckets.done.length > 0 && (
        <FoldList label={`${buckets.done.length} done`} items={buckets.done} handlers={handlers} />
      )}
      <CardAdd onAdd={onAdd} />
    </>
  )
}

function GoalCard({ card, handlers, onAdd }: { card: Card; handlers: TodoHandlers; onAdd: (text: string) => void }) {
  return (
    <div className="goal-card">
      <CardHead card={card} />
      <CardBody card={card} handlers={handlers} onAdd={onAdd} />
    </div>
  )
}

function ProjectCard({ card, handlers, onAdd }: { card: Card; handlers: TodoHandlers; onAdd: (text: string) => void }) {
  if (card.status === 'paused') {
    return (
      <details className="goal-card paused">
        <summary><CardHead card={card} /></summary>
        {card.note && <p className="goal-note">{card.note}</p>}
        <CardBody card={card} handlers={handlers} onAdd={onAdd} />
      </details>
    )
  }
  return (
    <div className="goal-card">
      <CardHead card={card} />
      {card.note && <p className="goal-note">{card.note}</p>}
      <CardBody card={card} handlers={handlers} onAdd={onAdd} />
    </div>
  )
}

export function ProjectsPage() {
  const [view, setView] = useState<'boot' | 'login' | 'app'>(getToken() ? 'boot' : 'login')
  const [goalsSnap, setGoalsSnap] = useState<GoalsSnapshot | null>(null)
  const [projectsSnap, setProjectsSnap] = useState<ProjectsSnapshot | null>(null)

  const showLogin = useCallback(() => {
    clearToken()
    setView('login')
  }, [])

  const { todos, status, load, mutate, recentlyMutated, reset } = useTodos(showLogin)

  const loadTodos = useCallback(async () => {
    const authed = await load()
    if (authed) setView('app')
  }, [load])

  const loadGoals = useCallback(async () => {
    try {
      const data = await apiFetch<{ goals: GoalsSnapshot | null }>('goals')
      setGoalsSnap(data.goals)
    } catch {
      setGoalsSnap(null)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiFetch<{ projects: ProjectsSnapshot | null }>('projects')
      setProjectsSnap(data.projects)
    } catch {
      setProjectsSnap(null)
    }
  }, [])

  const loadAll = useCallback(() => {
    loadTodos()
    loadGoals()
    loadProjects()
  }, [loadTodos, loadGoals, loadProjects])

  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    if (getToken()) loadAll()
    const refresh = () => {
      if (document.hidden || !getToken() || viewRef.current !== 'app') return
      if (recentlyMutated()) return
      loadAll()
    }
    document.addEventListener('visibilitychange', refresh)
    const id = setInterval(refresh, 60000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [loadAll, recentlyMutated])

  const handlers: TodoHandlers = {
    onCycle: todo => {
      const next = nextStateOf(todo)
      const doneOn = next === 'done' ? localDate() : null
      mutate(
        'todos',
        { method: 'PATCH', body: JSON.stringify({ id: todo.id, state: next, doneOn }) },
        prev => prev.map(t => (t.id === todo.id ? { ...t, state: next, done: next === 'done', doneOn } : t)),
      )
    },
    onDelete: todo => {
      mutate(
        `todos&id=${encodeURIComponent(todo.id)}`,
        { method: 'DELETE' },
        prev => prev.filter(t => t.id !== todo.id),
      )
    },
    onToday: todo => {
      const due = localDate()
      mutate(
        'todos',
        { method: 'PATCH', body: JSON.stringify({ id: todo.id, due }) },
        prev => prev.map(t => (t.id === todo.id ? { ...t, due } : t)),
      )
    },
  }

  const onProject = (todo: Todo, project: string) => {
    mutate(
      'todos',
      { method: 'PATCH', body: JSON.stringify({ id: todo.id, project }) },
      prev => prev.map(t => (t.id === todo.id ? { ...t, project } : t)),
    )
  }

  const addTo = (slug: string) => (text: string) => {
    const pending: Todo = {
      id: `pending-${Date.now()}`,
      text,
      state: 'todo',
      done: false,
      created: Date.now(),
      kind: 'global',
      doneOn: null,
      project: slug,
    }
    mutate(
      'todos',
      { method: 'POST', body: JSON.stringify({ text, kind: 'global', project: slug }) },
      prev => [pending, ...prev],
    )
  }

  const inbox = inboxOf(todos, localDate())
  const { containerRef, draggingId, dragOrder, startDrag } = useDragReorder(order => {
    mutate(
      'todos',
      { method: 'PUT', body: JSON.stringify({ order }) },
      prev => {
        const byId = (id: string) => prev.find(t => t.id === id)
        return [
          ...prev.filter(t => !order.includes(t.id)),
          ...order.map(byId).filter((t): t is Todo => Boolean(t)),
        ]
      },
    )
  })

  const inboxIds = inbox.map(t => t.id)
  const displayedInbox = dragOrder
    ? dragOrder.map(id => inbox.find(t => t.id === id)).filter((t): t is Todo => Boolean(t))
    : inbox

  const byProject = itemsByProject(todos)
  const goalCards = monthCards(goalsSnap, byProject)
  const projects = projectCards(goalsSnap, projectsSnap, byProject)
  const behind = behindCount(goalsSnap)
  const known = knownProjects(goalsSnap, projectsSnap, todos)

  return (
    <main>
      <HeaderNav title="projects" current="projects" showLogout={view === 'app'} onLogout={async () => {
        try {
          await apiFetch('logout', { method: 'POST' })
        } catch {}
        reset()
        showLogin()
      }} />

      {view === 'login' && <LoginForm onSuccess={loadAll} />}

      {view === 'app' && (
        <section id="app-view">
          <div className="section-title">
            <span id="month-title">
              {(goalsSnap ? goalsSnap.title : 'month') + ' — '}
              <span className={behind > 0 ? 'behind' : undefined}>
                {behind > 0 ? `${behind} behind pace` : 'on pace'}
              </span>
            </span>
            {inbox.length > 0 && (
              <a id="unsorted-link" href="#inbox">{inbox.length} unsorted ↓</a>
            )}
          </div>
          <div id="goal-cards">
            {goalCards.map(card => (
              <GoalCard key={card.key} card={card} handlers={handlers} onAdd={addTo(card.key)} />
            ))}
          </div>
          <p id="month-updated">
            {goalsSnap?.updated ? `as of ${goalsSnap.updated.slice(11, 16)}` : ''}
          </p>

          <div className="section-title"><span>projects</span></div>
          <div id="project-cards">
            {projects.map(card => (
              <ProjectCard key={card.key} card={card} handlers={handlers} onAdd={addTo(card.key)} />
            ))}
          </div>
          {projects.length === 0 && (
            <p id="projects-empty" className="empty-note">
              No side-projects declared — add entries to goals/projects.json in ubermensch.
            </p>
          )}

          <div className="section-title" id="inbox">
            <span>inbox</span>
            <span id="inbox-count">{inbox.length ? `${inbox.length} unsorted` : ''}</span>
          </div>
          <ul id="inbox-list" className="item-list" ref={containerRef}>
            {displayedInbox.map(t => (
              <TodoItem
                key={t.id}
                todo={t}
                withToday
                withTag
                knownProjects={known}
                dragging={draggingId === t.id}
                onDragStart={startDrag(t.id, inboxIds)}
                onCycle={handlers.onCycle}
                onDelete={handlers.onDelete}
                onToday={handlers.onToday}
                onProject={onProject}
              />
            ))}
          </ul>
          {inbox.length === 0 && <p id="inbox-empty" className="empty-note">Inbox clear.</p>}
          <p id="sync-status" className={status.error ? 'error' : undefined}>{status.text}</p>
        </section>
      )}
    </main>
  )
}
