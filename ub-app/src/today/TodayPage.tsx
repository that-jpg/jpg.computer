import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, clearToken, getToken, UnauthorizedError } from '../shared/api'
import { HeaderNav, NAV_LINKS } from '../shared/HeaderNav'
import { LoginForm } from '../shared/LoginForm'
import { TodoItem } from '../shared/TodoItem'
import { isDoneToday, kindOf, localDate, nextStateOf, stateOf } from '../shared/todos'
import type { CalendarDone, CalendarEvent, CalendarSnapshot, GoalsSnapshot, Habit, Todo, WeekGoal, WeekGoals } from '../shared/types'
import { useTodos } from '../shared/useTodos'
import { calLabel, currentWeek, eventState, shortWeek, stampWeek, todayBands } from './logic'

const TODAY_LINKS = [...NAV_LINKS, { href: '/ub/fisica3/', label: 'física 3' }]
const TIMER_EPOCH = new Date('2026-07-15T08:30:00-03:00')

function Timer() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const total = Math.max(0, Math.floor((Date.now() - TIMER_EPOCH.getTime()) / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <span className="stat-value" id="timer-value">
      {days}d {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  )
}

function EventItem({
  ev,
  state,
  past,
  calSnap,
  onCycle,
}: {
  ev: CalendarEvent
  state: 'todo' | 'doing' | 'done'
  past?: boolean
  calSnap: CalendarSnapshot | null
  onCycle: (ev: CalendarEvent, next: 'todo' | 'doing' | 'done') => void
}) {
  const nextState = state === 'todo' ? 'doing' : state === 'doing' ? 'done' : 'todo'
  const cal = calSnap ? (calSnap.calendars || []).find(c => c.id === ev.cal) : undefined
  const classes = [
    state === 'done' ? 'done' : '',
    state === 'doing' ? 'doing' : '',
    past ? 'event-past' : '',
  ].filter(Boolean).join(' ')
  return (
    <li className={classes || undefined}>
      <button className="todo-toggle" aria-label={`Mark as ${nextState}`} onClick={() => onCycle(ev, nextState)} />
      <span className="todo-text">{ev.title}</span>
      {!ev.allDay && (
        <span className="event-time">{ev.start.slice(11, 16)}–{ev.end.slice(11, 16)}</span>
      )}
      <span className="event-pill" style={{ background: cal ? cal.color : '#888' }}>
        {calLabel(ev, cal)}
      </span>
    </li>
  )
}

function HabitItem({ h, stale }: { h: Habit; stale: boolean }) {
  const classes = [
    'habit',
    h.done ? 'habit-done' : '',
    h.soft ? 'habit-soft' : '',
    stale ? 'habit-stale' : '',
  ].filter(Boolean).join(' ')
  return (
    <li className={classes}>
      <span className="habit-mark">{h.done ? '◆' : '◇'}</span>
      <span className="todo-text">{h.label}</span>
    </li>
  )
}

function WeekGoalItem({
  g,
  onToggle,
  onEdit,
  onDelete,
}: {
  g: WeekGoal
  onToggle: (g: WeekGoal) => void
  onEdit: (g: WeekGoal, text: string) => void
  onDelete: (g: WeekGoal) => void
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)
  return (
    <li className={g.done ? 'done' : undefined}>
      <button
        className="week-toggle"
        aria-label={g.done ? 'Mark goal open' : 'Mark goal done'}
        onClick={() => onToggle(g)}
      />
      {editing ? (
        <input
          ref={inputRef}
          className="week-edit"
          defaultValue={g.text}
          maxLength={200}
          autoFocus
          onBlur={() => {
            if (cancelledRef.current) {
              cancelledRef.current = false
              setEditing(false)
              return
            }
            const clean = inputRef.current!.value.replace(/\s+/g, ' ').trim()
            setEditing(false)
            if (!clean || clean === g.text) return
            onEdit(g, clean)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              inputRef.current!.blur()
            }
            if (e.key === 'Escape') {
              cancelledRef.current = true
              inputRef.current!.blur()
            }
          }}
        />
      ) : (
        <span className="todo-text" onClick={() => setEditing(true)}>{g.text}</span>
      )}
      <button className="todo-delete" aria-label="Delete goal" onClick={() => onDelete(g)}>×</button>
    </li>
  )
}

export function TodayPage() {
  const [view, setView] = useState<'boot' | 'login' | 'app'>(getToken() ? 'boot' : 'login')
  const [goalsSnap, setGoalsSnap] = useState<GoalsSnapshot | null>(null)
  const [calSnap, setCalSnap] = useState<CalendarSnapshot | null>(null)
  const [calDone, setCalDone] = useState<CalendarDone>({})
  const [weekGoals, setWeekGoals] = useState<WeekGoals | null>(null)
  const [weekAddOpen, setWeekAddOpen] = useState(false)
  const [kindDaily, setKindDaily] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const weekAddRef = useRef<HTMLInputElement>(null)
  const weekSeqRef = useRef(0)

  const showLogin = useCallback(() => {
    clearToken()
    setView('login')
  }, [])

  const { todos, status, setStatus, load, mutate, recentlyMutated, markMutated, reset } = useTodos(showLogin)

  const loadTodos = useCallback(async () => {
    const authed = await load()
    if (authed) setView('app')
  }, [load])

  const loadGoals = useCallback(async () => {
    try {
      setGoalsSnap((await apiFetch<{ goals: GoalsSnapshot | null }>('goals')).goals)
    } catch {
      setGoalsSnap(null)
    }
  }, [])

  const loadWeekGoals = useCallback(async () => {
    try {
      setWeekGoals((await apiFetch<{ weekGoals: WeekGoals | null }>('week-goals')).weekGoals)
    } catch {
      setWeekGoals(null)
    }
  }, [])

  const loadCalendar = useCallback(async () => {
    try {
      const [calData, doneData] = await Promise.all([
        apiFetch<{ calendar: CalendarSnapshot | null }>('calendar'),
        apiFetch<{ done: CalendarDone | null }>('calendar-done'),
      ])
      setCalSnap(calData.calendar)
      setCalDone(doneData.done || {})
    } catch {
      setCalSnap(null)
    }
  }, [])

  const loadAll = useCallback(() => {
    loadTodos()
    loadGoals()
    loadWeekGoals()
    loadCalendar()
  }, [loadTodos, loadGoals, loadWeekGoals, loadCalendar])

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

  useEffect(() => {
    if (view === 'app') addInputRef.current?.focus()
  }, [view])

  const mutateWeek = useCallback(
    async (query: string, init: RequestInit, optimistic?: (prev: WeekGoals | null) => WeekGoals | null) => {
      if (optimistic) setWeekGoals(optimistic)
      const seq = ++weekSeqRef.current
      markMutated()
      setStatus({ text: 'saving...', error: false })
      try {
        const data = await apiFetch<{ weekGoals: WeekGoals | null }>(query, init)
        markMutated()
        if (seq === weekSeqRef.current) {
          setWeekGoals(data.weekGoals)
          setStatus({ text: 'saved', error: false })
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          showLogin()
          return
        }
        setStatus({ text: 'sync failed - refresh to see the saved list', error: true })
      }
    },
    [markMutated, setStatus, showLogin],
  )

  const onCycle = (todo: Todo) => {
    if (kindOf(todo) === 'daily') {
      const doneOn = isDoneToday(todo, localDate()) ? null : localDate()
      mutate(
        'todos',
        { method: 'PATCH', body: JSON.stringify({ id: todo.id, doneOn }) },
        prev => prev.map(t => (t.id === todo.id ? { ...t, doneOn } : t)),
      )
    } else {
      const next = nextStateOf(todo)
      const doneOn = next === 'done' ? localDate() : null
      mutate(
        'todos',
        { method: 'PATCH', body: JSON.stringify({ id: todo.id, state: next, doneOn }) },
        prev => prev.map(t => (t.id === todo.id ? { ...t, state: next, done: next === 'done', doneOn } : t)),
      )
    }
  }

  const onDelete = (todo: Todo) => {
    mutate(
      `todos&id=${encodeURIComponent(todo.id)}`,
      { method: 'DELETE' },
      prev => prev.filter(t => t.id !== todo.id),
    )
  }

  const onProject = (todo: Todo, project: string) => {
    mutate(
      'todos',
      { method: 'PATCH', body: JSON.stringify({ id: todo.id, project }) },
      prev => prev.map(t => (t.id === todo.id ? { ...t, project } : t)),
    )
  }

  const onEventCycle = async (ev: CalendarEvent, next: 'todo' | 'doing' | 'done') => {
    const today = localDate()
    const key = [ev.cal, ev.start, ev.title].join('|')
    setCalDone(prev => {
      const day = { ...(prev[today] || {}) }
      if (next === 'todo') delete day[key]
      else day[key] = next
      return { ...prev, [today]: day }
    })
    try {
      await apiFetch('calendar-done', {
        method: 'POST',
        body: JSON.stringify({ date: today, key, state: next }),
      })
      setStatus({ text: 'saved', error: false })
    } catch (e) {
      if (e instanceof UnauthorizedError) return showLogin()
      setStatus({ text: 'sync failed - event state not saved', error: true })
    }
  }

  const knownProjects = (() => {
    const keys: string[] = []
    for (const g of goalsSnap ? goalsSnap.goals : []) keys.push(g.key)
    for (const t of todos) {
      if (t.project && !keys.includes(t.project)) keys.push(t.project)
    }
    return keys
  })()

  const today = localDate()
  const bands = todayBands(todos, goalsSnap, calSnap, calDone, today, new Date())
  const notes = goalsSnap && goalsSnap.notes ? goalsSnap.notes : null

  const weekStale = weekGoals && weekGoals.week ? weekGoals.week < currentWeek() : false
  const hasWeek = Boolean(weekGoals && weekGoals.week)

  const todoRow = (t: Todo, withTag: boolean) => (
    <TodoItem
      key={t.id}
      todo={t}
      stateOverride={kindOf(t) === 'daily' ? (isDoneToday(t, today) ? 'done' : 'todo') : undefined}
      toggleLabel={kindOf(t) === 'daily'
        ? (isDoneToday(t, today) ? 'Mark as not done' : 'Mark as done')
        : undefined}
      withTag={withTag && knownProjects.length > 0}
      knownProjects={knownProjects}
      onCycle={onCycle}
      onDelete={onDelete}
      onProject={onProject}
    />
  )

  return (
    <main>
      <HeaderNav
        title="today"
        current="today"
        links={TODAY_LINKS}
        showLogout={view === 'app'}
        onLogout={async () => {
          try {
            await apiFetch('logout', { method: 'POST' })
          } catch {}
          reset()
          showLogin()
        }}
      />

      {view === 'login' && <LoginForm onSuccess={loadAll} />}

      {view === 'app' && (
        <section id="app-view">
          <div id="notes-widget">
            <span className="stat-label">notes</span>
            <span id="notes-value">
              {notes
                ? <>{notes.total} <em>total</em> · {notes.week_daily_avg} <em>/day last week</em></>
                : '—'}
            </span>
          </div>
          <div id="timer-widget">
            <span className="stat-label">since became a God</span>
            <Timer />
          </div>

          <div id="week-strip" className={weekStale ? 'stale' : undefined}>
            <div id="week-strip-head">
              <span id="week-label">{hasWeek ? shortWeek(weekGoals!.week) : 'week'}</span>
              {weekStale && <span id="week-stale-note">last week — keep or delete, then</span>}
              {(!hasWeek || weekStale) && (
                <button
                  id="week-start"
                  onClick={() => {
                    const week = stampWeek()
                    mutateWeek(
                      'week-goals',
                      { method: 'PUT', body: JSON.stringify({ week }) },
                      prev => prev
                        ? { week, goals: prev.goals.filter(g => !g.done) }
                        : { week, goals: [] },
                    )
                  }}
                >
                  start {shortWeek(stampWeek())}
                </button>
              )}
              {hasWeek && !weekStale && (
                <button
                  id="week-add"
                  aria-label="Add weekly goal"
                  onClick={() => {
                    setWeekAddOpen(open => !open)
                    setTimeout(() => weekAddRef.current?.focus(), 0)
                  }}
                >
                  +
                </button>
              )}
            </div>
            <ul id="week-goal-list" className="item-list">
              {hasWeek && weekGoals!.goals.map(g => (
                <WeekGoalItem
                  key={g.id}
                  g={g}
                  onToggle={goal => {
                    mutateWeek(
                      'week-goals',
                      { method: 'PATCH', body: JSON.stringify({ id: goal.id, done: !goal.done }) },
                      prev => prev && {
                        ...prev,
                        goals: prev.goals.map(x => (x.id === goal.id ? { ...x, done: !goal.done } : x)),
                      },
                    )
                  }}
                  onEdit={(goal, text) => {
                    mutateWeek(
                      'week-goals',
                      { method: 'PATCH', body: JSON.stringify({ id: goal.id, text }) },
                      prev => prev && {
                        ...prev,
                        goals: prev.goals.map(x => (x.id === goal.id ? { ...x, text } : x)),
                      },
                    )
                  }}
                  onDelete={goal => {
                    mutateWeek(
                      `week-goals&id=${encodeURIComponent(goal.id)}`,
                      { method: 'DELETE' },
                      prev => prev && { ...prev, goals: prev.goals.filter(x => x.id !== goal.id) },
                    )
                  }}
                />
              ))}
            </ul>
            {hasWeek && !weekStale && weekGoals!.goals.length === 0 && (
              <p id="week-empty">no goals this week</p>
            )}
            {weekAddOpen && hasWeek && !weekStale && (
              <form
                id="week-add-form"
                onSubmit={e => {
                  e.preventDefault()
                  const text = weekAddRef.current!.value.replace(/\s+/g, ' ').trim()
                  if (!text || !weekGoals) return
                  weekAddRef.current!.value = ''
                  mutateWeek(
                    'week-goals',
                    { method: 'POST', body: JSON.stringify({ text }) },
                    prev => prev && {
                      ...prev,
                      goals: [...prev.goals, { id: `pending-${Date.now()}`, text, done: false }],
                    },
                  )
                }}
              >
                <input ref={weekAddRef} id="week-add-input" maxLength={200} placeholder="goal for the week" autoComplete="off" />
              </form>
            )}
          </div>

          <form
            id="add-form"
            onSubmit={e => {
              e.preventDefault()
              const text = addInputRef.current!.value.trim()
              if (!text) return
              const kind = kindDaily ? 'daily' : 'global'
              addInputRef.current!.value = ''
              const pending: Todo = {
                id: `pending-${Date.now()}`,
                text,
                state: 'todo',
                done: false,
                created: Date.now(),
                kind,
                doneOn: null,
              }
              mutate(
                'todos',
                { method: 'POST', body: JSON.stringify({ text, kind }) },
                prev => [pending, ...prev],
              )
            }}
          >
            <input ref={addInputRef} id="add-input" placeholder="New todo" maxLength={500} autoComplete="off" />
            <button
              type="button"
              id="kind-toggle"
              className={kindDaily ? 'active' : undefined}
              aria-pressed={kindDaily}
              onClick={() => setKindDaily(v => !v)}
            >
              daily
            </button>
            <button type="submit">Add</button>
          </form>

          <div className="section-title">
            <span>today</span>
            <span id="today-count">{bands.left === 0 ? 'clear' : `${bands.left} left`}</span>
          </div>
          <ul id="overdue-list" className="item-list">
            {bands.overdue.map(t => todoRow(t, !t.project))}
          </ul>
          <ul id="due-list" className="item-list">
            {bands.dueToday.map(t => todoRow(t, !t.project))}
          </ul>
          <ul id="event-list" className="item-list">
            {bands.eventsOpen.map(ev => (
              <EventItem
                key={[ev.cal, ev.start, ev.title].join('|')}
                ev={ev}
                state={eventState(ev, calDone, today)}
                calSnap={calSnap}
                onCycle={onEventCycle}
              />
            ))}
          </ul>
          <ul id="daily-list" className="item-list">
            {bands.dailyOpen.map(t => todoRow(t, false))}
          </ul>
          <ul id="habit-list" className="item-list">
            {bands.habitsOpen.map(h => <HabitItem key={h.key} h={h} stale={bands.habitsStale} />)}
          </ul>
          <ul id="done-today-list" className="item-list">
            {bands.doneTodayTodos.map(t => todoRow(t, false))}
            {bands.dailyDone.map(t => todoRow(t, false))}
            {bands.habitsDone.map(h => <HabitItem key={h.key} h={h} stale={false} />)}
            {bands.eventsSunk.map(ev => (
              <EventItem
                key={[ev.cal, ev.start, ev.title].join('|')}
                ev={ev}
                state={eventState(ev, calDone, today)}
                past={!ev.allDay && new Date(ev.end) <= new Date() && eventState(ev, calDone, today) !== 'done'}
                calSnap={calSnap}
                onCycle={onEventCycle}
              />
            ))}
          </ul>
          {bands.habitsStale && bands.habits.length > 0 && (
            <p id="habit-note">habits stale — snapshot from {bands.habitsDate}</p>
          )}
          {bands.left === 0 && bands.eventsOpen.length === 0
            && bands.doneTodayTodos.length + bands.dailyDone.length + bands.habitsDone.length + bands.eventsSunk.length === 0 && (
            <p id="empty-state">Nothing to do.</p>
          )}
          {bands.doneHistory.length > 0 && (
            <details id="done-section">
              <summary id="done-summary">done ({bands.doneHistory.length})</summary>
              <ul id="done-list" className="item-list">
                {bands.doneHistory.map(t => todoRow(t, false))}
              </ul>
            </details>
          )}
          <p id="sync-status" className={status.error ? 'error' : undefined}>{status.text}</p>
        </section>
      )}
    </main>
  )
}
