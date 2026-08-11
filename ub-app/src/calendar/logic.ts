import type { CalendarEvent, CalendarSnapshot } from '../shared/types'

export function pd(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fd(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

export function addDays(date: Date, n: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

export interface TimedItem {
  ev: CalendarEvent
  s: number
  e: number
  col: number
  ncols: number
}

export function visibleEvents(snap: CalendarSnapshot, hidden: ReadonlySet<string>): CalendarEvent[] {
  return (snap.events || []).filter(ev => !hidden.has(ev.cal))
}

export function alldayFor(events: CalendarEvent[], dayStr: string): CalendarEvent[] {
  return events.filter(ev =>
    ev.allDay && ev.start <= dayStr && (ev.end > dayStr || ev.end <= ev.start),
  )
}

export function timedFor(events: CalendarEvent[], day: Date): TimedItem[] {
  const dayStart = day.getTime()
  const dayEnd = addDays(day, 1).getTime()
  const items: TimedItem[] = []
  for (const ev of events) {
    if (ev.allDay) continue
    const s = new Date(ev.start).getTime()
    const e = Math.max(new Date(ev.end).getTime(), s + 1)
    if (e <= dayStart || s >= dayEnd) continue
    items.push({ ev, s: Math.max(s, dayStart), e: Math.min(e, dayEnd), col: 0, ncols: 1 })
  }
  items.sort((a, b) => a.s - b.s || b.e - a.e)
  return items
}

export function layout(items: TimedItem[]): TimedItem[] {
  let cluster: TimedItem[] = []
  let colEnds: number[] = []
  let clusterEnd = 0
  const flush = () => {
    for (const item of cluster) item.ncols = colEnds.length
    cluster = []
    colEnds = []
  }
  for (const item of items) {
    if (cluster.length && item.s >= clusterEnd) flush()
    let col = colEnds.findIndex(end => end <= item.s)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(item.e)
    } else {
      colEnds[col] = item.e
    }
    item.col = col
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.e)
  }
  flush()
  return items
}

export function hourRange(days: Date[], events: CalendarEvent[]): [number, number] {
  let min = 8
  let max = 21
  for (const day of days) {
    for (const item of timedFor(events, day)) {
      const start = new Date(item.s)
      const end = new Date(item.e - 1)
      min = Math.min(min, start.getHours())
      max = Math.max(max, end.getHours() + 1)
    }
  }
  return [min, max]
}
