import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../shared/types'
import { addDays, alldayFor, fd, hourRange, layout, mondayOf, pd, timedFor } from './logic'

function ev(overrides: Partial<CalendarEvent>): CalendarEvent {
  return { cal: 'g', title: 'x', start: '', end: '', allDay: false, ...overrides }
}

function timed(start: string, end: string): CalendarEvent {
  return ev({ start, end })
}

const day = pd('2026-08-11')

describe('date helpers', () => {
  it('round-trips iso dates', () => {
    expect(fd(pd('2026-08-11'))).toBe('2026-08-11')
  })

  it('finds monday of a week', () => {
    expect(fd(mondayOf(pd('2026-08-11')))).toBe('2026-08-10')
    expect(fd(mondayOf(pd('2026-08-10')))).toBe('2026-08-10')
    expect(fd(mondayOf(pd('2026-08-16')))).toBe('2026-08-10')
  })

  it('adds days across month boundaries', () => {
    expect(fd(addDays(pd('2026-08-30'), 3))).toBe('2026-09-02')
  })
})

describe('alldayFor', () => {
  it('includes multi-day spans up to the exclusive end', () => {
    const events = [ev({ allDay: true, start: '2026-08-10', end: '2026-08-12' })]
    expect(alldayFor(events, '2026-08-10')).toHaveLength(1)
    expect(alldayFor(events, '2026-08-11')).toHaveLength(1)
    expect(alldayFor(events, '2026-08-12')).toHaveLength(0)
  })

  it('shows end <= start events from their start date onward', () => {
    const events = [ev({ allDay: true, start: '2026-08-11', end: '2026-08-11' })]
    expect(alldayFor(events, '2026-08-10')).toHaveLength(0)
    expect(alldayFor(events, '2026-08-11')).toHaveLength(1)
    expect(alldayFor(events, '2026-08-12')).toHaveLength(1)
  })
})

describe('timedFor', () => {
  it('clips events to the day window and sorts by start', () => {
    const events = [
      timed('2026-08-11T23:00:00-03:00', '2026-08-12T01:00:00-03:00'),
      timed('2026-08-11T09:00:00-03:00', '2026-08-11T10:00:00-03:00'),
      timed('2026-08-10T09:00:00-03:00', '2026-08-10T10:00:00-03:00'),
    ]
    const items = timedFor(events, day)
    expect(items).toHaveLength(2)
    expect(new Date(items[0].s).getHours()).toBe(9)
    expect(items[1].e).toBe(addDays(day, 1).getTime())
  })

  it('skips allDay events', () => {
    expect(timedFor([ev({ allDay: true, start: '2026-08-11', end: '2026-08-12' })], day)).toHaveLength(0)
  })
})

describe('layout', () => {
  it('keeps non-overlapping events in one full-width column', () => {
    const items = layout(timedFor([
      timed('2026-08-11T09:00:00-03:00', '2026-08-11T10:00:00-03:00'),
      timed('2026-08-11T10:00:00-03:00', '2026-08-11T11:00:00-03:00'),
    ], day))
    expect(items.map(i => [i.col, i.ncols])).toEqual([[0, 1], [0, 1]])
  })

  it('splits overlapping events into columns', () => {
    const items = layout(timedFor([
      timed('2026-08-11T09:00:00-03:00', '2026-08-11T11:00:00-03:00'),
      timed('2026-08-11T10:00:00-03:00', '2026-08-11T12:00:00-03:00'),
    ], day))
    expect(items.map(i => [i.col, i.ncols])).toEqual([[0, 2], [1, 2]])
  })

  it('reuses freed columns inside a cluster and resets between clusters', () => {
    const items = layout(timedFor([
      timed('2026-08-11T09:00:00-03:00', '2026-08-11T12:00:00-03:00'),
      timed('2026-08-11T09:30:00-03:00', '2026-08-11T10:00:00-03:00'),
      timed('2026-08-11T10:30:00-03:00', '2026-08-11T11:00:00-03:00'),
      timed('2026-08-11T14:00:00-03:00', '2026-08-11T15:00:00-03:00'),
    ], day))
    expect(items.map(i => [i.col, i.ncols])).toEqual([[0, 2], [1, 2], [1, 2], [0, 1]])
  })
})

describe('hourRange', () => {
  it('defaults to 8-21 with no events', () => {
    expect(hourRange([day], [])).toEqual([8, 21])
  })

  it('expands to cover early and late events', () => {
    const events = [
      timed('2026-08-11T06:30:00-03:00', '2026-08-11T07:00:00-03:00'),
      timed('2026-08-11T22:00:00-03:00', '2026-08-11T23:30:00-03:00'),
    ]
    expect(hourRange([day], events)).toEqual([6, 24])
  })
})
