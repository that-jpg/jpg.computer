import { isDoneToday, isOverdue, kindOf, stateOf } from '../shared/todos'
import type { Calendar, CalendarDone, CalendarEvent, CalendarSnapshot, GoalsSnapshot, Habit, Todo } from '../shared/types'

export function isoWeekOf(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function currentWeek(): string {
  return isoWeekOf(new Date())
}

export function stampWeek(): string {
  const d = new Date()
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return isoWeekOf(d)
}

export function shortWeek(week: string): string {
  return week.slice(5).toLowerCase()
}

export function eventsToday(calSnap: CalendarSnapshot | null, today: string): CalendarEvent[] {
  if (!calSnap || !Array.isArray(calSnap.events)) return []
  const skipped = new Set(
    (calSnap.calendars || []).filter(c => c.today === false).map(c => c.id),
  )
  const matches = calSnap.events.filter(ev => !skipped.has(ev.cal) && (ev.allDay
    ? ev.start <= today && (ev.end > today || ev.end <= ev.start)
    : ev.start.slice(0, 10) === today))
  return matches.sort((a, b) =>
    Number(b.allDay === true) - Number(a.allDay === true) || (a.start < b.start ? -1 : 1),
  )
}

export function eventKey(ev: CalendarEvent): string {
  return [ev.cal, ev.start, ev.title].join('|')
}

export function eventState(ev: CalendarEvent, calDone: CalendarDone, today: string): 'todo' | 'doing' | 'done' {
  return (calDone[today] || {})[eventKey(ev)] || 'todo'
}

export function calLabel(ev: CalendarEvent, cal: Calendar | undefined): string {
  const name = cal ? cal.name : ev.cal
  const short = name.includes('@') ? name.split('@')[0] : name
  return short.length > 12 ? `${short.slice(0, 11)}…` : short
}

export interface TodayBands {
  overdue: Todo[]
  dueToday: Todo[]
  eventsOpen: CalendarEvent[]
  eventsSunk: CalendarEvent[]
  dailyOpen: Todo[]
  dailyDone: Todo[]
  habitsOpen: Habit[]
  habitsDone: Habit[]
  doneTodayTodos: Todo[]
  doneHistory: Todo[]
  habits: Habit[]
  habitsStale: boolean
  habitsDate: string | null
  left: number
}

export function todayBands(
  todos: Todo[],
  goalsSnap: GoalsSnapshot | null,
  calSnap: CalendarSnapshot | null,
  calDone: CalendarDone,
  today: string,
  now: Date,
): TodayBands {
  const byDue = (a: Todo, b: Todo) => (a.due! < b.due! ? -1 : 1)
  const daily = todos.filter(t => kindOf(t) === 'daily')
  const globals = todos.filter(t => kindOf(t) === 'global')
  const open = globals.filter(t => stateOf(t) !== 'done')
  const overdue = open.filter(t => isOverdue(t, today)).sort(byDue)
  const dueToday = open.filter(t => t.due === today)
  const doneGlobals = globals.filter(t => stateOf(t) === 'done')
  const doneTodayTodos = doneGlobals.filter(t => t.doneOn === today)
  const doneHistory = doneGlobals.filter(t => t.doneOn !== today)
  const dailyOpen = daily.filter(t => !isDoneToday(t, today))
  const dailyDone = daily.filter(t => isDoneToday(t, today))

  const todayBlock = goalsSnap && goalsSnap.today ? goalsSnap.today : null
  const habitsStale = todayBlock ? todayBlock.date !== today : false
  const habits = todayBlock ? todayBlock.habits : []
  const habitsOpen = habitsStale ? habits : habits.filter(h => !h.done)
  const habitsDone = habitsStale ? [] : habits.filter(h => h.done)

  const dayEvents = eventsToday(calSnap, today)
  const isPast = (ev: CalendarEvent) => !ev.allDay && new Date(ev.end) <= now
  const eventsOpen = dayEvents.filter(ev => eventState(ev, calDone, today) !== 'done' && !isPast(ev))
  const eventsSunk = dayEvents.filter(ev => eventState(ev, calDone, today) === 'done' || isPast(ev))

  const left = overdue.length + dueToday.length + eventsOpen.length + dailyOpen.length
    + (habitsStale ? 0 : habitsOpen.length)

  return {
    overdue,
    dueToday,
    eventsOpen,
    eventsSunk,
    dailyOpen,
    dailyDone,
    habitsOpen,
    habitsDone,
    doneTodayTodos,
    doneHistory,
    habits,
    habitsStale,
    habitsDate: todayBlock ? todayBlock.date : null,
    left,
  }
}
