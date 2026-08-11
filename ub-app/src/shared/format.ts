export const STALE_MS = 45 * 60 * 1000

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function timeLabel(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
}

export function formatAsOf(updatedIso: string, now: number): { text: string; stale: boolean } {
  const updated = new Date(updatedIso)
  const stale = now - updated.getTime() > STALE_MS
  const when = `${shortDate(updated)} ${timeLabel(updated)}`
  return { text: stale ? `stale — as of ${when}` : `as of ${when}`, stale }
}
