import { describe, expect, it } from 'vitest'
import type { CalendarSnapshot, GoalsSnapshot, Todo } from '../shared/types'
import { calLabel, eventKey, eventsToday, eventState, isoWeekOf, todayBands } from './logic'

function todo(overrides: Partial<Todo>): Todo {
  return { id: Math.random().toString(36).slice(2), text: 'x', done: false, ...overrides }
}

const TODAY = '2026-08-11'
const NOW = new Date('2026-08-11T15:00:00-03:00')

describe('isoWeekOf', () => {
  it('stamps iso weeks across year boundaries', () => {
    expect(isoWeekOf(new Date(2026, 7, 11))).toBe('2026-W33')
    expect(isoWeekOf(new Date(2026, 0, 1))).toBe('2026-W01')
    expect(isoWeekOf(new Date(2027, 0, 1))).toBe('2026-W53')
  })
})

describe('eventsToday', () => {
  const snap: CalendarSnapshot = {
    generated: '',
    window: { start: '2026-08-01', end: '2026-08-31' },
    calendars: [
      { id: 'g', name: 'main', color: '#fff', primary: true },
      { id: 'skip', name: 'work', color: '#000', primary: false, today: false },
    ],
    events: [
      { cal: 'g', title: 'timed', start: '2026-08-11T10:00:00-03:00', end: '2026-08-11T11:00:00-03:00', allDay: false },
      { cal: 'g', title: 'allday', start: '2026-08-11', end: '2026-08-12', allDay: true },
      { cal: 'skip', title: 'hidden', start: '2026-08-11T09:00:00-03:00', end: '2026-08-11T10:00:00-03:00', allDay: false },
      { cal: 'g', title: 'other-day', start: '2026-08-12T09:00:00-03:00', end: '2026-08-12T10:00:00-03:00', allDay: false },
    ],
  }

  it('keeps today events, drops skipped calendars, allday first', () => {
    const events = eventsToday(snap, TODAY)
    expect(events.map(e => e.title)).toEqual(['allday', 'timed'])
  })
})

describe('todayBands', () => {
  const goals: GoalsSnapshot = {
    title: 'august',
    updated: '',
    goals: [],
    today: {
      date: TODAY,
      habits: [
        { key: 'h1', label: 'sleep', done: true },
        { key: 'h2', label: 'stretch', done: false },
      ],
    },
  }
  const todos = [
    todo({ id: 'over', due: '2026-08-01' }),
    todo({ id: 'today-due', due: TODAY }),
    todo({ id: 'future', due: '2026-08-20' }),
    todo({ id: 'inbox' }),
    todo({ id: 'daily-open', kind: 'daily' }),
    todo({ id: 'daily-done', kind: 'daily', doneOn: TODAY }),
    todo({ id: 'done-today', state: 'done', doneOn: TODAY }),
    todo({ id: 'done-old', state: 'done', doneOn: '2026-08-05' }),
  ]

  it('assembles the urgency bands', () => {
    const bands = todayBands(todos, goals, null, {}, TODAY, NOW)
    expect(bands.overdue.map(t => t.id)).toEqual(['over'])
    expect(bands.dueToday.map(t => t.id)).toEqual(['today-due'])
    expect(bands.dailyOpen.map(t => t.id)).toEqual(['daily-open'])
    expect(bands.dailyDone.map(t => t.id)).toEqual(['daily-done'])
    expect(bands.doneTodayTodos.map(t => t.id)).toEqual(['done-today'])
    expect(bands.doneHistory.map(t => t.id)).toEqual(['done-old'])
    expect(bands.habitsOpen.map(h => h.key)).toEqual(['h2'])
    expect(bands.habitsDone.map(h => h.key)).toEqual(['h1'])
    expect(bands.left).toBe(4)
  })

  it('marks habits stale on a date mismatch and stops counting them', () => {
    const staleGoals = { ...goals, today: { ...goals.today!, date: '2026-08-10' } }
    const bands = todayBands(todos, staleGoals, null, {}, TODAY, NOW)
    expect(bands.habitsStale).toBe(true)
    expect(bands.habitsOpen).toHaveLength(2)
    expect(bands.habitsDone).toHaveLength(0)
    expect(bands.left).toBe(3)
  })

  it('sinks past and done events', () => {
    const snap: CalendarSnapshot = {
      generated: '',
      window: { start: '2026-08-01', end: '2026-08-31' },
      calendars: [{ id: 'g', name: 'main', color: '#fff', primary: true }],
      events: [
        { cal: 'g', title: 'past', start: '2026-08-11T10:00:00-03:00', end: '2026-08-11T11:00:00-03:00', allDay: false },
        { cal: 'g', title: 'upcoming', start: '2026-08-11T20:00:00-03:00', end: '2026-08-11T21:00:00-03:00', allDay: false },
        { cal: 'g', title: 'done-ev', start: '2026-08-11T18:00:00-03:00', end: '2026-08-11T19:00:00-03:00', allDay: false },
      ],
    }
    const done = { [TODAY]: { [eventKey(snap.events[2])]: 'done' as const } }
    const bands = todayBands([], null, snap, done, TODAY, NOW)
    expect(bands.eventsOpen.map(e => e.title)).toEqual(['upcoming'])
    expect(bands.eventsSunk.map(e => e.title)).toEqual(['past', 'done-ev'])
    expect(eventState(snap.events[2], done, TODAY)).toBe('done')
  })
})

describe('calLabel', () => {
  it('shortens emails and truncates long names', () => {
    expect(calLabel({ cal: 'x', title: '', start: '', end: '', allDay: false },
      { id: 'x', name: 'someone@gmail.com', color: '', primary: true })).toBe('someone')
    expect(calLabel({ cal: 'x', title: '', start: '', end: '', allDay: false },
      { id: 'x', name: 'a-very-long-calendar', color: '', primary: true })).toBe('a-very-long…')
  })
})
