import { MeterBar } from '../shared/MeterBar'
import type { GoalsSnapshot } from '../shared/types'

export function MonthSection({ goals }: { goals: GoalsSnapshot | null | undefined }) {
  if (goals === undefined) return null

  const allGoals = goals ? goals.goals : []
  const behind = allGoals.flatMap(g => g.meters).filter(m => m.ok === false).length
  const rows = allGoals.filter(g => g.meters.length > 0)
  const empty = !goals || allGoals.length === 0
  const title = goals ? goals.title : 'month'

  return (
    <section id="month-section">
      <div id="month-title">
        {title + ' — '}
        <span className={behind > 0 ? 'behind' : undefined}>
          {behind > 0 ? `${behind} behind pace` : 'on pace'}
        </span>
      </div>
      {empty && <p className="month-empty">no goals set</p>}
      {rows.map(g => (
        <div className="month-goal" key={g.key}>
          <span className="mg-title">{g.title}</span>
          <div className="mg-meters">
            {g.meters.map((m, i) => (
              <MeterBar key={i} m={m} />
            ))}
          </div>
        </div>
      ))}
      {goals?.updated && <p id="month-updated">as of {goals.updated.slice(11, 16)}</p>}
    </section>
  )
}
