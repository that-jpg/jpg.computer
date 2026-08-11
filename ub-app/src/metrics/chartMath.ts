import type { AccuracyPoint, FinanceMonth } from '../shared/types'

export const SERIES = '#14a37f'
export const REF = '#a3a3a3'
export const SPEND_COLORS = ['#14a37f', '#3987e5', '#c98500', '#d55181', '#9085e9']
export const OTHER_COLOR = '#8a8a85'

export const BRL_FMT = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
})

export const BRL_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
})

export function fmt(n: number | null | undefined): string {
  return n == null ? '—' : Math.round(n).toLocaleString('en-US')
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function dayNum(iso: string): number {
  return Date.parse(iso + 'T12:00:00') / 86400000
}

export function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

export function barPath(x: number, y: number, w: number, baseY: number): string {
  if (baseY - y < 1) return `M${x},${baseY} L${x},${y} L${x + w},${y} L${x + w},${baseY} Z`
  const r = Math.min(4, (baseY - y) / 2, w / 2)
  return `M${x},${baseY} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${baseY} Z`
}

export type Point = [number, number]

export function linePath(points: Point[]): string {
  return points
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ')
}

export interface ChartBox {
  w: number
  h: number
  left: number
  right: number
  top: number
  bottom: number
}

export interface TimeScale {
  box: ChartBox
  xOf: (iso: string) => number
  yOf: (v: number) => number
  plotW: number
  plotH: number
  baseY: number
}

export interface TimeScaleOpts {
  h: number
  xMin: string
  xMax: string
  yMin: number
  yMax: number
}

export function timeScale(opts: TimeScaleOpts): TimeScale {
  const box: ChartBox = { w: 480, h: opts.h, left: 34, right: 10, top: 14, bottom: 20 }
  const plotW = box.w - box.left - box.right
  const plotH = box.h - box.top - box.bottom
  const x0 = dayNum(opts.xMin)
  const x1 = dayNum(opts.xMax)
  const xOf = (iso: string) => box.left + plotW * (x1 === x0 ? 0.5 : (dayNum(iso) - x0) / (x1 - x0))
  const yOf = (v: number) => box.top + plotH * (1 - (v - opts.yMin) / (opts.yMax - opts.yMin))
  return { box, xOf, yOf, plotW, plotH, baseY: box.top + plotH }
}

export interface RollingPoint {
  date: string
  reviews: number
  pct: number | null
}

export function rollingAccuracy(series: AccuracyPoint[]): RollingPoint[] {
  if (series.length === 0) return []
  const byDate = Object.fromEntries(series.map(p => [p.date, p]))
  const first = series[0].date
  const last = series[series.length - 1].date
  const points: RollingPoint[] = []
  for (let d = first; d <= last; d = isoAddDays(d, 1)) {
    let reviews = 0
    let correct = 0
    for (let k = 0; k < 7; k++) {
      const p = byDate[isoAddDays(d, -k)]
      if (p) {
        reviews += p.reviews
        correct += p.correct
      }
    }
    points.push({ date: d, reviews, pct: reviews ? 100 * correct / reviews : null })
  }
  return points
}

export function spendCategories(months: FinanceMonth[]): string[] {
  const totals: Record<string, number> = {}
  for (const m of months) {
    for (const [name, value] of Object.entries(m.by_category || {})) {
      totals[name] = (totals[name] || 0) + value
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SPEND_COLORS.length)
    .map(([name]) => name)
}

export function fillDays(series: AccuracyPoint[]): AccuracyPoint[] {
  if (series.length === 0) return []
  const byDate = Object.fromEntries(series.map(p => [p.date, p]))
  const days: AccuracyPoint[] = []
  for (let d = series[0].date; d <= series[series.length - 1].date; d = isoAddDays(d, 1)) {
    days.push(byDate[d] || { date: d, reviews: 0, correct: 0 })
  }
  return days
}

export function cumulativePieces(pieces: { date: string; thrown: number }[]): { date: string; total: number; thrown: number }[] {
  let acc = 0
  return pieces.map(p => ({ date: p.date, total: (acc += p.thrown), thrown: p.thrown }))
}
