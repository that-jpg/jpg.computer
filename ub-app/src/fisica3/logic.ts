import type { Fisica3Chapter, Fisica3Snapshot } from '../shared/types'

export { STALE_MS } from '../shared/format'

export const BADGE_TEXT = {
  done: 'done',
  behind: 'behind',
  due_soon: 'due soon',
  on_track: 'on track',
  no_date: 'no date',
} as const

export interface BlockGroup {
  label: 'MC' | 'Q' | 'P'
  from: number
  to: number
}

export function blockGroups(ch: Fisica3Chapter): BlockGroup[] {
  return [
    { label: 'MC', from: 1, to: ch.q_start - 1 },
    { label: 'Q', from: ch.q_start, to: ch.p_start - 1 },
    { label: 'P', from: ch.p_start, to: ch.max },
  ]
}

export function blockTallies(ch: Fisica3Chapter): string {
  const solved = new Set(ch.solved)
  return blockGroups(ch)
    .map(b => `${b.label} ${[...solved].filter(n => n >= b.from && n <= b.to).length}/${b.to - b.from + 1}`)
    .join(' · ')
}

export function badgeText(ch: Fisica3Chapter): string {
  return ch.deadline && ch.status !== 'done'
    ? `${BADGE_TEXT[ch.status]} · due ${ch.deadline}`
    : BADGE_TEXT[ch.status]
}

export function wrongSet(ch: Fisica3Chapter): Set<number> {
  return new Set(ch.wrong ?? [])
}

export function redoText(count: number): string {
  return count ? ` · ${count} to redo` : ''
}

export function courseTotals(snap: Fisica3Snapshot): { total: number; solved: number; wrong: number } {
  return {
    total: snap.chapters.reduce((sum, ch) => sum + ch.max, 0),
    solved: snap.chapters.reduce((sum, ch) => sum + ch.solved.length, 0),
    wrong: snap.chapters.reduce((sum, ch) => sum + wrongSet(ch).size, 0),
  }
}

export function pctOf(solved: number, total: number): string {
  return total ? (100 * solved / total).toFixed(1) : '0.0'
}

export { formatAsOf } from '../shared/format'
