import type { ReactNode } from 'react'
import type { BrandOfGods, VenturesSnapshot } from '../shared/types'
import { BRL_CENTS, cumulativePieces, fmt, REF, shortDate, timeScale } from './chartMath'
import { AxisText, ChartWrap, HoverBands, RefLine, SeriesLine, TimeFrame } from './charts'

function FollowersChart({ v }: { v: VenturesSnapshot }) {
  const s = v.stolas!
  const series = s.followers || []
  const yMax = Math.ceil(Math.max(s.target, ...series.map(p => p.count)) * 1.05 / 50) * 50
  const c = timeScale({ h: 150, xMin: s.start_date, xMax: s.target_date, yMin: 0, yMax })
  const last = series[series.length - 1]
  return (
    <ChartWrap svgId="followers-chart" viewBox="0 0 480 150" ariaLabel="Instagram followers against the growth pace">
      {tip => (
        <>
          <TimeFrame c={c} xMin={s.start_date} xMax={s.target_date} yGrid={[100, 200]} yFmt={fmt} />
          <RefLine
            points={[[c.xOf(s.start_date), c.yOf(s.start)], [c.xOf(s.target_date), c.yOf(s.target)]]}
            label={`pace to ${s.target}`}
          />
          <SeriesLine points={series.map(p => [c.xOf(p.date), c.yOf(p.count)])} />
          <AxisText x={c.xOf(last.date) + 4} y={c.yOf(last.count) - 7} anchor="start" color="#e2e8f0">
            {fmt(last.count)}
          </AxisText>
          <HoverBands
            entries={series.map(p => ({ x: c.xOf(p.date), p }))}
            height={c.box.h}
            tip={tip}
            content={p => <>{shortDate(p.date)}<br />{p.count} followers</>}
          />
        </>
      )}
    </ChartWrap>
  )
}

function IwaChart({ v }: { v: VenturesSnapshot }) {
  const pieces = v.iwa.pieces || []
  const cumulative = cumulativePieces(pieces)
  const total = cumulative.length ? cumulative[cumulative.length - 1].total : 0
  const yMax = Math.max(v.iwa.target, total) + 3
  const c = timeScale({ h: 140, xMin: pieces[0].date, xMax: pieces[pieces.length - 1].date, yMin: 0, yMax })
  return (
    <ChartWrap svgId="iwa-chart" viewBox="0 0 480 140" ariaLabel="Cumulative pieces thrown against the plan">
      {tip => (
        <>
          <TimeFrame c={c} xMin={pieces[0].date} xMax={pieces[pieces.length - 1].date} yGrid={[v.iwa.target]} />
          <line
            x1={c.box.left} x2={480 - c.box.right} y1={c.yOf(v.iwa.target)} y2={c.yOf(v.iwa.target)}
            stroke={REF} strokeWidth={1.5} strokeDasharray="5 4"
          />
          <AxisText x={480 - c.box.right} y={c.yOf(v.iwa.target) - 4} anchor="end" color="#888">
            plan {v.iwa.target}
          </AxisText>
          <SeriesLine points={cumulative.map(p => [c.xOf(p.date), c.yOf(p.total)])} />
          <HoverBands
            entries={cumulative.map(p => ({ x: c.xOf(p.date), p }))}
            height={c.box.h}
            tip={tip}
            content={p => <>{shortDate(p.date)}<br />+{p.thrown} thrown · {p.total} total</>}
          />
        </>
      )}
    </ChartWrap>
  )
}

function StatTile({ label, value, sub, cls }: { label: string; value: ReactNode; sub: string; cls?: string }) {
  return (
    <div>
      <span className="stat-label">{label}</span>
      <span className={`stat-value${cls ? ' ' + cls : ''}`}>{value}</span>
      <span className="stat-sub">{sub}</span>
    </div>
  )
}

function money(n: number | null | undefined): string {
  return n == null ? '—' : BRL_CENTS.format(n)
}

function BogPanel({ b }: { b: BrandOfGods }) {
  return (
    <div className="chart-block" id="bog-block">
      <div className="chart-head">
        <span>brand of gods ledger</span>
        <span className="chart-note" id="bog-note">{b.rows} rows · last {shortDate(b.last_date!)}</span>
      </div>
      <div className="stat-row" id="bog-tiles">
        <StatTile
          label="net cash"
          value={BRL_CENTS.format(b.cash!.net)}
          sub={`in ${BRL_CENTS.format(b.cash!.in)} · out ${BRL_CENTS.format(b.cash!.out)}`}
          cls={b.cash!.net >= 0 ? 'stat-delta-good' : 'stat-delta-bad'}
        />
        {Object.entries(b.units || {}).map(([sku, u]) => {
          const parts = [`${u.bought} bought`, `${u.sold} sold`]
          if (u.seeded) parts.push(`${u.seeded} seeded`)
          if (u.returned) parts.push(`${u.returned} returned`)
          return <StatTile key={sku} label={`${sku} on hand`} value={u.on_hand} sub={parts.join(' · ')} />
        })}
        {Object.entries(b.unit_econ || {}).map(([sku, e]) => {
          if (e.contribution == null) return null
          const behindPlan = e.plan_contribution != null && e.contribution < e.plan_contribution
          const sub = e.plan_contribution != null
            ? `plan ${BRL_CENTS.format(e.plan_contribution)} · landed ${BRL_CENTS.format(e.landed!)}`
            : `landed ${BRL_CENTS.format(e.landed!)}`
          return (
            <StatTile
              key={sku}
              label={`contribution / ${sku}`}
              value={BRL_CENTS.format(e.contribution)}
              sub={sub}
              cls={behindPlan ? 'stat-delta-bad' : 'stat-delta-good'}
            />
          )
        })}
      </div>
      <details>
        <summary>per sold unit + channels</summary>
        <table id="bog-econ-table">
          <tbody>
            <tr>
              {['per sold unit', 'gross', 'fees', 'shipping', 'net', 'landed', 'contribution'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
            {Object.entries(b.unit_econ || {}).map(([sku, e]) => (
              <tr key={sku}>
                <td>{sku}</td>
                <td>{money(e.gross)}</td>
                <td>{money(e.fees)} ({(e.fee_share * 100).toFixed(1)}%)</td>
                <td>{money(e.shipping)}</td>
                <td>{money(e.net)}</td>
                <td>{money(e.landed)}</td>
                <td>{money(e.contribution)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table id="bog-channel-table">
          <tbody>
            <tr>
              {['channel', 'sold', 'net'].map(h => <th key={h}>{h}</th>)}
            </tr>
            {Object.entries(b.channels || {}).sort().map(([channel, c]) => (
              <tr key={channel}>
                <td>{channel}</td>
                <td>{c.sold}</td>
                <td>{money(c.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

export function VenturesDomain({ v }: { v: VenturesSnapshot | null | undefined }) {
  const empty = v !== undefined && (!v || !v.stolas)
  const followers = v?.stolas?.followers || []
  const pieces = v?.iwa?.pieces || []
  const total = pieces.reduce((sum, p) => sum + p.thrown, 0)
  const b = v?.brand_of_gods
  const bogInvalid = b && (b.error || !b.rows)
  const s = v?.stolas
  const last = followers.length ? followers[followers.length - 1] : null
  const gap = s && last ? last.count - s.pace_today : null
  return (
    <section className="domain" id="ventures-domain">
      <h2 className="domain-title">ventures</h2>
      {!empty && v && s && (
        <>
          <div className="chart-block" id="followers-block">
            <div className="chart-head">
              <span>stolas followers vs pace</span>
              <span className="chart-note" id="followers-note">
                {last ? `${last.count} now · pace ${s.pace_today}` : ''}
              </span>
            </div>
            {followers.length > 0 && <FollowersChart v={v} />}
            <p className="chart-caption" id="followers-caption">
              {followers.length === 0
                ? 'no follower snapshots yet'
                : (
                    <>
                      target {s.target} by {shortDate(s.target_date)} ·{' '}
                      <span className={gap! >= 0 ? 'stat-delta-good' : 'stat-delta-bad'}>
                        {gap! >= 0 ? '+' : ''}{gap} vs pace
                      </span>
                    </>
                  )}
            </p>
          </div>
          {pieces.length > 0 ? (
            <div className="chart-block" id="iwa-block">
              <div className="chart-head">
                <span>iwa pieces thrown</span>
                <span className="chart-note" id="iwa-note">{total}/{v.iwa.target}</span>
              </div>
              <IwaChart v={v} />
              <p className="chart-caption" id="iwa-caption">cumulative pieces thrown this cycle</p>
            </div>
          ) : (
            <p className="empty-note" id="iwa-empty">
              production.csv not started — the chart begins with the first throw day.
            </p>
          )}
          {b && !bogInvalid && <BogPanel b={b} />}
          {b && bogInvalid && (
            <p className="empty-note" id="bog-empty">
              {b.error ? `brand of gods ledger invalid: ${b.error}` : 'brand of gods ledger.jsonl is empty.'}
            </p>
          )}
        </>
      )}
      {empty && <p className="empty-note" id="ventures-empty">No ventures snapshot yet.</p>}
    </section>
  )
}
