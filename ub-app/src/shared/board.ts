import type { CalendarDone, CalendarEvent, CalendarSnapshot, WeekGoals } from './types'

export type Column = 'backlog' | 'todo' | 'doing' | 'done'
export type Lane = 'today' | 'later'
export type Kind = 'task' | 'routine' | 'auto-routine'
export type ProjectStatus = 'active' | 'paused' | 'archived'
export type SignalName = 'food' | 'weighin' | 'anki' | 'agares' | 'training' | 'stolas_low' | 'ig'

export const COLUMNS: Column[] = ['backlog', 'todo', 'doing', 'done']
export const TODAY_COLUMNS: Column[] = ['todo', 'doing', 'done']
export const SIGNALS: SignalName[] = ['food', 'weighin', 'anki', 'agares', 'training', 'stolas_low', 'ig']
export const CALENDAR_SLUG = 'calendar'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Card {
  id: string
  text: string
  kind: Kind
  project: string | null
  column: Column
  date: string | null
  expires: boolean
  key: string | null
  description: string
  checklist: ChecklistItem[]
  template: string | null
  signal: string | null
  order: number
  todayOrder: number | null
  created: number
  doneOn: string | null
  doneVia: 'tap' | 'expiry' | 'signal' | null
  journaled: boolean
}

export type RecurrenceRule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'monthly'; dom: number }

export interface Template {
  id: string
  title: string
  kind: 'routine' | 'auto-routine'
  rule: RecurrenceRule
  whileAway: boolean
  signal: SignalName | null
  mode: 'always' | 'on-signal' | null
}

export interface Project {
  slug: string
  title: string
  prefix: string
  note: string
  status: ProjectStatus
  order: number
  counter: number
  templates: Template[]
}

export interface AwayRange {
  start: string
  end: string
}

export interface Registry {
  updated: string | null
  lastRollover: string | null
  projects: Project[]
  away: AwayRange[]
}

export interface AllPayload {
  today: string
  now: string
  cards: Card[]
  registry: Registry
  signals: { date: string; updated: string | null } | null
  weekGoals: WeekGoals | null
  calendar: CalendarSnapshot | null
  calendarDone: CalendarDone
  notes: { total: number; week_daily_avg: number } | null
}

export interface CalCard {
  key: string
  ev: CalendarEvent
  date: string
  state: 'todo' | 'doing' | 'done'
  ended: boolean
  color: string
  calLabel: string
}

export function localToday(): string {
  return new Date().toLocaleDateString('en-CA')
}

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

export function shortDate(iso: string): string {
  return new Date(iso + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toLowerCase()
}

export function nextColumn(column: Column): Column {
  return column === 'todo' || column === 'backlog' ? 'doing' : column === 'doing' ? 'done' : 'todo'
}

export function inToday(card: Card, today: string): boolean {
  if (card.kind !== 'task') return card.date === today
  if (card.column === 'done') return card.doneOn === today
  if (card.column === 'backlog' || card.project === null) return false
  return !card.date || card.date <= today
}

export function isOverdue(card: Card, today: string): boolean {
  return card.kind === 'task' && card.column !== 'done' && Boolean(card.date) && card.date! < today
}

export function laneOf(card: Card, today: string): Lane {
  return inToday(card, today) ? 'today' : 'later'
}

export function kindRank(card: Card): number {
  return card.kind === 'task' ? 0 : card.kind === 'routine' ? 1 : 2
}

export function sortToday(cards: Card[], today: string): Card[] {
  return [...cards].sort((a, b) => {
    const ao = a.todayOrder
    const bo = b.todayOrder
    if (ao !== null && bo !== null && ao !== bo) return ao - bo
    if (ao !== null && bo === null) return -1
    if (ao === null && bo !== null) return 1
    const aOver = isOverdue(a, today) ? 0 : 1
    const bOver = isOverdue(b, today) ? 0 : 1
    if (aOver !== bOver) return aOver - bOver
    if (aOver === 0 && a.date !== b.date) return a.date! < b.date! ? -1 : 1
    if (kindRank(a) !== kindRank(b)) return kindRank(a) - kindRank(b)
    return a.order - b.order
  })
}

export function sortDone(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.doneOn !== b.doneOn) return (a.doneOn || '') < (b.doneOn || '') ? -1 : 1
    return a.order - b.order
  })
}

export function sortLater(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.order - b.order || a.created - b.created)
}

export interface LaneCells {
  today: Record<Column, Card[]>
  later: Record<Column, Card[]>
}

function emptyCells(): Record<Column, Card[]> {
  return { backlog: [], todo: [], doing: [], done: [] }
}

export function laneCells(cards: Card[], today: string): LaneCells {
  const cells: LaneCells = { today: emptyCells(), later: emptyCells() }
  for (const card of cards) cells[laneOf(card, today)][card.column].push(card)
  for (const column of COLUMNS) {
    cells.today[column] = column === 'done' ? sortDone(cells.today[column]) : sortToday(cells.today[column], today)
    cells.later[column] = column === 'done' ? sortDone(cells.later[column]) : sortLater(cells.later[column])
  }
  return cells
}

export function activeProjects(registry: Registry): Project[] {
  return registry.projects.filter(p => p.status === 'active').sort((a, b) => a.order - b.order)
}

export function projectsByOrder(registry: Registry): Project[] {
  return [...registry.projects].sort((a, b) => a.order - b.order)
}

export function boardCards(cards: Card[], slug: string): Card[] {
  return cards.filter(c => c.project === slug)
}

export function inboxCards(cards: Card[]): Card[] {
  return sortLater(cards.filter(c => c.project === null && c.kind === 'task' && c.column !== 'done'))
}

export function openCount(cards: Card[]): number {
  return cards.filter(c => c.column !== 'done').length
}

export function todayLeft(cards: Card[], today: string): number {
  return cards.filter(c => inToday(c, today) && c.column !== 'done').length
}

export function projectOf(registry: Registry, slug: string | null): Project | null {
  return registry.projects.find(p => p.slug === slug) || null
}

export function eventKey(ev: CalendarEvent): string {
  return [ev.cal, ev.start, ev.title].join('|')
}

export function calLabel(name: string): string {
  const short = name.includes('@') ? name.split('@')[0] : name
  return short.length > 12 ? `${short.slice(0, 11)}…` : short
}

export function eventDate(ev: CalendarEvent): string {
  return ev.start.slice(0, 10)
}

export function calendarCards(
  calendar: CalendarSnapshot | null,
  calendarDone: CalendarDone,
  today: string,
  now: Date,
): CalCard[] {
  if (!calendar || !Array.isArray(calendar.events)) return []
  const skipped = new Set((calendar.calendars || []).filter(c => c.today === false).map(c => c.id))
  const colors = new Map((calendar.calendars || []).map(c => [c.id, c]))
  const cards: CalCard[] = []
  for (const ev of calendar.events) {
    if (skipped.has(ev.cal)) continue
    const date = ev.allDay
      ? (ev.start <= today && (ev.end > today || ev.end <= ev.start) ? today : eventDate(ev))
      : eventDate(ev)
    if (date < today) continue
    const key = eventKey(ev)
    const stored = (calendarDone[date] || {})[key]
    const ended = !ev.allDay && new Date(ev.end) <= now
    const cal = colors.get(ev.cal)
    cards.push({
      key,
      ev,
      date,
      state: stored || 'todo',
      ended,
      color: cal ? cal.color : '#888',
      calLabel: calLabel(cal ? cal.name : ev.cal),
    })
  }
  return cards.sort((a, b) =>
    (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    || Number(b.ev.allDay) - Number(a.ev.allDay)
    || (a.ev.start < b.ev.start ? -1 : 1),
  )
}

export function signalsStale(payload: Pick<AllPayload, 'signals' | 'today'>): boolean {
  return !payload.signals || payload.signals.date !== payload.today
}

export function ruleLabel(rule: RecurrenceRule): string {
  if (rule.type === 'daily') return 'every day'
  if (rule.type === 'monthly') return `monthly on the ${rule.dom}`
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return rule.days.length === 7 ? 'every day' : rule.days.map(d => names[d]).join(' ') || 'never'
}

export function kindGlyph(kind: Kind): string {
  return kind === 'routine' ? '↻' : kind === 'auto-routine' ? '◇' : ''
}
