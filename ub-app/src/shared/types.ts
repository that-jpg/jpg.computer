export interface Calendar {
  id: string
  name: string
  color: string
  source?: string
  primary: boolean
  today?: boolean
}

export interface CalendarEvent {
  cal: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
}

export interface CalendarSnapshot {
  generated: string
  window: { start: string; end: string }
  calendars: Calendar[]
  events: CalendarEvent[]
  errors?: string[]
}

export type TodoState = 'todo' | 'doing' | 'done'

export interface Todo {
  id: string
  text: string
  state?: TodoState
  done: boolean
  doneOn?: string | null
  due?: string | null
  kind?: 'daily' | 'global'
  project?: string | null
  created?: number
}

export interface Meter {
  key?: string
  label: string
  text: string
  pct?: number | null
  pace_pct?: number | null
  ok?: boolean | null
}

export interface Goal {
  key: string
  title: string
  meters: Meter[]
}

export interface Habit {
  key: string
  label: string
  done: boolean
  soft?: boolean
}

export interface GoalsSnapshot {
  title: string
  updated: string
  goals: Goal[]
  today?: { date: string; habits: Habit[] }
  notes?: { total: number; week_daily_avg: number }
}

export interface WeekGoal {
  id: string
  text: string
  done: boolean
}

export interface WeekGoals {
  week: string
  goals: WeekGoal[]
}

export type CalendarDone = Record<string, Record<string, 'doing' | 'done'>>

export interface ProjectEntry {
  slug: string
  title: string
  status: 'active' | 'paused'
  note?: string | null
  untracked?: boolean
}

export interface ProjectsSnapshot {
  updated: string
  projects: ProjectEntry[]
}

export interface WeightPlan {
  current: number
  cut_start: number
  cut_target: number
  cut_start_date: string
  cut_end_date: string
}

export interface FitnessSnapshot {
  weight?: WeightPlan | null
  weight_series?: { date: string; kg: number }[]
  kcal_series?: { date: string; in: number | null; target: number | null }[]
  training_weeks?: { week: string; sessions: number }[]
}

export interface AccuracyPoint {
  date: string
  reviews: number
  correct: number
}

export interface FrenchSnapshot {
  vocab?: { known: number; total: number; introduced: number } | null
  today: { reviews: number; quota: number }
  accuracy_series?: AccuracyPoint[]
  vocab_series?: { date: string; known: number; introduced: number }[]
}

export interface FinanceMonth {
  month: string
  income: number
  spend: number
  net: number
  by_category?: Record<string, number>
}

export interface FinanceSnapshot {
  net_worth?: { total: number; series: { date: string; total: number }[] } | null
  months?: FinanceMonth[]
  allocation?: Record<string, { share: number }>
}

export interface BrandOfGods {
  error?: string
  rows?: number
  last_date?: string
  cash?: { in: number; out: number; net: number }
  units?: Record<string, { bought: number; sold: number; seeded?: number; returned?: number; on_hand: number }>
  unit_econ?: Record<string, {
    gross: number | null
    fees: number | null
    fee_share: number
    shipping: number | null
    net: number | null
    landed: number | null
    contribution: number | null
    plan_contribution: number | null
  }>
  channels?: Record<string, { sold: number; net: number | null }>
}

export interface VenturesSnapshot {
  stolas?: {
    followers?: { date: string; count: number }[]
    start: number
    start_date: string
    target: number
    target_date: string
    pace_today: number
  } | null
  iwa: { pieces?: { date: string; thrown: number }[]; target: number }
  brand_of_gods?: BrandOfGods | null
}

export type ChapterStatus = 'done' | 'behind' | 'due_soon' | 'on_track' | 'no_date'

export interface Fisica3Chapter {
  ch: number
  title: string
  q_start: number
  p_start: number
  ad_start: number
  max: number
  solved: number[]
  wrong: number[]
  deadline: string | null
  status: ChapterStatus
}

export interface Fisica3Snapshot {
  updated: string
  course: string
  book: string
  next_up: number | null
  fim: string | null
  has_dates: boolean
  chapters: Fisica3Chapter[]
}
