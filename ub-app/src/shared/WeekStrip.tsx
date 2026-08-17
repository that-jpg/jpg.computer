import { useEffect, useRef, useState } from 'react'
import { currentWeek, shortWeek, stampWeek } from './board'
import type { WeekGoal, WeekGoals } from './types'

const TIMER_EPOCH = new Date('2026-07-15T08:30:00-03:00')

export function Timer() {
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

export type WeekMutate = (
  query: string,
  init: RequestInit,
  optimistic?: (prev: WeekGoals | null) => WeekGoals | null,
) => Promise<unknown>

export function WeekStrip({
  weekGoals,
  notes,
  mutateWeek,
}: {
  weekGoals: WeekGoals | null
  notes: { total: number; week_daily_avg: number } | null
  mutateWeek: WeekMutate
}) {
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLInputElement>(null)
  const weekStale = weekGoals && weekGoals.week ? weekGoals.week < currentWeek() : false
  const hasWeek = Boolean(weekGoals && weekGoals.week)

  return (
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
                prev => prev ? { week, goals: prev.goals.filter(g => !g.done) } : { week, goals: [] },
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
              setAddOpen(open => !open)
              setTimeout(() => addRef.current?.focus(), 0)
            }}
          >
            +
          </button>
        )}
        <span id="week-widgets">
          <span id="notes-value" title="journal notes">
            {notes ? <>{notes.total} <em>notes</em> · {notes.week_daily_avg}<em>/day</em></> : ''}
          </span>
          <Timer />
        </span>
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
                prev => prev && { ...prev, goals: prev.goals.map(x => (x.id === goal.id ? { ...x, done: !goal.done } : x)) },
              )
            }}
            onEdit={(goal, text) => {
              mutateWeek(
                'week-goals',
                { method: 'PATCH', body: JSON.stringify({ id: goal.id, text }) },
                prev => prev && { ...prev, goals: prev.goals.map(x => (x.id === goal.id ? { ...x, text } : x)) },
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
      {addOpen && hasWeek && !weekStale && (
        <form
          id="week-add-form"
          onSubmit={e => {
            e.preventDefault()
            const text = addRef.current!.value.replace(/\s+/g, ' ').trim()
            if (!text || !weekGoals) return
            addRef.current!.value = ''
            mutateWeek(
              'week-goals',
              { method: 'POST', body: JSON.stringify({ text }) },
              prev => prev && { ...prev, goals: [...prev.goals, { id: `pending-${Date.now()}`, text, done: false }] },
            )
          }}
        >
          <input ref={addRef} id="week-add-input" maxLength={200} placeholder="goal for the week" autoComplete="off" />
        </form>
      )}
    </div>
  )
}
