import type { Meter } from './types'

export function MeterBar({ m }: { m: Meter }) {
  return (
    <div className={`goal-meter${m.ok === false ? ' gm-bad' : ''}`}>
      <div className="gm-head">
        <span>{m.label}</span>
        <span className="gm-text">{m.text}</span>
      </div>
      <div className="gm-bar">
        <div className="gm-fill" style={{ width: `${Math.max(0, Math.min(100, m.pct || 0))}%` }} />
        {m.pace_pct != null && m.pace_pct > 0 && (
          <div className="gm-tick" style={{ left: `calc(${Math.min(m.pace_pct, 100)}% - 1px)` }} />
        )}
      </div>
    </div>
  )
}
