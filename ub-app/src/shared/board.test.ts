import { describe, expect, it } from 'vitest'
import {
  activeProjects,
  calendarCards,
  inboxCards,
  inToday,
  isOverdue,
  laneCells,
  ruleLabel,
  sortToday,
  todayLeft,
  type Card,
  type Registry,
} from './board'
import type { CalendarSnapshot } from './types'

const TODAY = '2026-08-17'

function card(over: Partial<Card> & { id: string }): Card {
  return {
    text: over.id,
    kind: 'task',
    project: 'iwa',
    column: 'todo',
    date: null,
    expires: false,
    key: null,
    description: '',
    checklist: [],
    template: null,
    signal: null,
    order: 0,
    todayOrder: null,
    created: 1,
    doneOn: null,
    doneVia: null,
    journaled: false,
    ...over,
  }
}

describe('inToday', () => {
  it('tasks join Today by date, done tasks by doneOn', () => {
    expect(inToday(card({ id: 'a', date: TODAY }), TODAY)).toBe(true)
    expect(inToday(card({ id: 'b', date: '2026-08-10' }), TODAY)).toBe(true)
    expect(inToday(card({ id: 'c', date: '2026-08-20' }), TODAY)).toBe(false)
    expect(inToday(card({ id: 'd' }), TODAY)).toBe(false)
    expect(inToday(card({ id: 'e', column: 'done', doneOn: TODAY }), TODAY)).toBe(true)
    expect(inToday(card({ id: 'f', column: 'done', doneOn: '2026-08-16', date: TODAY }), TODAY)).toBe(false)
  })

  it('routine cards are in Today only on their date', () => {
    expect(inToday(card({ id: 'r', kind: 'routine', date: TODAY }), TODAY)).toBe(true)
    expect(inToday(card({ id: 's', kind: 'auto-routine', date: '2026-08-16' }), TODAY)).toBe(false)
  })
})

describe('laneCells and ordering', () => {
  const cards = [
    card({ id: 'later-todo', order: 2 }),
    card({ id: 'backlog', column: 'backlog', order: 0 }),
    card({ id: 'today-todo', date: TODAY, order: 5 }),
    card({ id: 'overdue', date: '2026-08-15', order: 1 }),
    card({ id: 'routine', kind: 'routine', date: TODAY, order: 0 }),
    card({ id: 'auto', kind: 'auto-routine', date: TODAY, order: 0 }),
    card({ id: 'pinned', date: TODAY, todayOrder: 0, order: 9 }),
    card({ id: 'done-today', column: 'done', doneOn: TODAY }),
    card({ id: 'done-old', column: 'done', doneOn: '2026-08-14' }),
  ]

  it('splits into today and later lanes with urgency order in Today', () => {
    const cells = laneCells(cards, TODAY)
    expect(cells.today.todo.map(c => c.id)).toEqual(['pinned', 'overdue', 'today-todo', 'routine', 'auto'])
    expect(cells.today.done.map(c => c.id)).toEqual(['done-today'])
    expect(cells.later.backlog.map(c => c.id)).toEqual(['backlog'])
    expect(cells.later.todo.map(c => c.id)).toEqual(['later-todo'])
    expect(cells.later.done.map(c => c.id)).toEqual(['done-old'])
  })

  it('sortToday puts explicit today order first, then overdue oldest first', () => {
    const sorted = sortToday([
      card({ id: 'b', date: '2026-08-12' }),
      card({ id: 'a', date: '2026-08-10' }),
      card({ id: 'p', date: TODAY, todayOrder: 3 }),
    ], TODAY)
    expect(sorted.map(c => c.id)).toEqual(['p', 'a', 'b'])
  })

  it('counts open Today cards and flags overdue', () => {
    expect(todayLeft(cards, TODAY)).toBe(5)
    expect(isOverdue(card({ id: 'x', date: '2026-08-01' }), TODAY)).toBe(true)
    expect(isOverdue(card({ id: 'y', date: '2026-08-01', column: 'done' }), TODAY)).toBe(false)
  })
})

describe('inbox and registry helpers', () => {
  it('inbox is project-less tasks in manual order', () => {
    const cards = [
      card({ id: 'b', project: null, order: 2 }),
      card({ id: 'a', project: null, order: 1 }),
      card({ id: 'r', project: null, kind: 'routine' }),
      card({ id: 'd', project: null, column: 'done', doneOn: TODAY }),
      card({ id: 'p' }),
    ]
    expect(inboxCards(cards).map(c => c.id)).toEqual(['a', 'b'])
  })

  it('activeProjects follows the hand-set order and skips paused/archived', () => {
    const registry: Registry = {
      updated: null,
      lastRollover: null,
      away: [],
      projects: [
        { slug: 'b', title: 'b', prefix: 'B', note: '', status: 'active', order: 1, counter: 0, templates: [] },
        { slug: 'a', title: 'a', prefix: 'A', note: '', status: 'active', order: 0, counter: 0, templates: [] },
        { slug: 'p', title: 'p', prefix: 'P', note: '', status: 'paused', order: 2, counter: 0, templates: [] },
      ],
    }
    expect(activeProjects(registry).map(p => p.slug)).toEqual(['a', 'b'])
  })

  it('labels recurrence rules', () => {
    expect(ruleLabel({ type: 'daily' })).toBe('every day')
    expect(ruleLabel({ type: 'weekdays', days: [0] })).toBe('sun')
    expect(ruleLabel({ type: 'monthly', dom: 5 })).toBe('monthly on the 5')
  })
})

describe('calendarCards', () => {
  const calendar: CalendarSnapshot = {
    generated: '',
    window: { start: '2026-08-10', end: '2026-09-14' },
    calendars: [
      { id: 'main', name: 'me@example.com', color: '#7bd148', primary: true },
      { id: 'hidden', name: 'other', color: '#4986e7', primary: false, today: false },
    ],
    events: [
      { cal: 'main', title: 'later', start: '2026-08-20T10:00:00-03:00', end: '2026-08-20T11:00:00-03:00', allDay: false },
      { cal: 'main', title: 'past', start: '2026-08-16T10:00:00-03:00', end: '2026-08-16T11:00:00-03:00', allDay: false },
      { cal: 'main', title: 'now', start: '2026-08-17T09:00:00-03:00', end: '2026-08-17T10:00:00-03:00', allDay: false },
      { cal: 'main', title: 'allday', start: '2026-08-17', end: '2026-08-18', allDay: true },
      { cal: 'hidden', title: 'nope', start: '2026-08-17T12:00:00-03:00', end: '2026-08-17T13:00:00-03:00', allDay: false },
    ],
  }

  it('projects today and upcoming events, skipping excluded calendars and past days', () => {
    const cards = calendarCards(calendar, { [TODAY]: { 'main|2026-08-17T09:00:00-03:00|now': 'done' } }, TODAY, new Date('2026-08-17T12:00:00-03:00'))
    expect(cards.map(c => c.ev.title)).toEqual(['allday', 'now', 'later'])
    expect(cards.find(c => c.ev.title === 'now')!.state).toBe('done')
    expect(cards.find(c => c.ev.title === 'now')!.ended).toBe(true)
    expect(cards.find(c => c.ev.title === 'allday')!.calLabel).toBe('me')
  })
})
