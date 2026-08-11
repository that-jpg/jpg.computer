import type { FitnessSnapshot } from '../shared/types'
import { barPath, fmt, REF, SERIES, shortDate, timeScale } from './chartMath'
import { AxisText, ChartWrap, HoverBands, RefLine, SeriesLine, TimeFrame } from './charts'

function WeightChart({ f }: { f: FitnessSnapshot }) {
  const w = f.weight
  const series = f.weight_series || []
  if (!w || series.length === 0) {
    return (
      <ChartWrap svgId="weight-chart" viewBox="0 0 480 200" ariaLabel="Bodyweight over time against the cut plan">
        {() => null}
      </ChartWrap>
    )
  }
  const xMin = series[0].date < w.cut_start_date ? series[0].date : w.cut_start_date
  const xMax = w.cut_end_date
  const kgs = series.map(p => p.kg).concat([w.cut_start, w.cut_target])
  const yMin = Math.floor(Math.min(...kgs) - 0.5)
  const yMax = Math.ceil(Math.max(...kgs) + 0.5)
  const grid: number[] = []
  for (let v = yMin; v <= yMax; v += 1) grid.push(v)
  const c = timeScale({ h: 200, xMin, xMax, yMin, yMax })
  const pts = series.map(p => [c.xOf(p.date), c.yOf(p.kg)] as [number, number])
  const last = series[series.length - 1]
  return (
    <ChartWrap svgId="weight-chart" viewBox="0 0 480 200" ariaLabel="Bodyweight over time against the cut plan">
      {tip => (
        <>
          <TimeFrame c={c} xMin={xMin} xMax={xMax} yGrid={grid} yFmt={v => v.toFixed(0)} />
          <RefLine
            points={[[c.xOf(w.cut_start_date), c.yOf(w.cut_start)], [c.xOf(w.cut_end_date), c.yOf(w.cut_target)]]}
            label={`plan ${w.cut_target.toFixed(1)}`}
          />
          <SeriesLine points={pts} />
          <AxisText x={c.xOf(last.date)} y={c.yOf(last.kg) - 8} color="#e2e8f0">{last.kg.toFixed(1)}</AxisText>
          <HoverBands
            entries={series.map(p => ({ x: c.xOf(p.date), p }))}
            height={c.box.h}
            tip={tip}
            content={p => <>{shortDate(p.date)}<br />{p.kg.toFixed(1)} kg</>}
          />
        </>
      )}
    </ChartWrap>
  )
}

function KcalChart({ f }: { f: FitnessSnapshot }) {
  const series = f.kcal_series || []
  const box = { w: 480, h: 160, left: 34, right: 6, top: 14, bottom: 20 }
  const plotW = box.w - box.left - box.right
  const plotH = box.h - box.top - box.bottom
  const baseY = box.top + plotH
  const band = series.length ? plotW / series.length : plotW
  const barW = Math.min(10, band * 0.62)
  const maxVal = Math.max(2500, ...series.flatMap(d => [d.in || 0, d.target || 0]))
  const yMax = Math.ceil(maxVal / 500) * 500
  const yOf = (v: number) => box.top + plotH * (1 - v / yMax)
  const gridVals: number[] = []
  for (let v = 1000; v <= yMax; v += 1000) gridVals.push(v)
  return (
    <ChartWrap svgId="kcal-chart" viewBox="0 0 480 160" ariaLabel="Calories per day over the last 30 days">
      {tip => series.length === 0 ? null : (
        <>
          {gridVals.map(v => (
            <g key={v}>
              <line x1={box.left} x2={box.w - box.right} y1={yOf(v)} y2={yOf(v)} stroke="#1a1a1a" strokeWidth={1} />
              <AxisText x={box.left - 5} y={yOf(v) + 3} anchor="end">{fmt(v)}</AxisText>
            </g>
          ))}
          <line x1={box.left} x2={box.w - box.right} y1={baseY} y2={baseY} stroke="#333" strokeWidth={1} />
          {series.map((d, i) => {
            const cx = box.left + band * i + band / 2
            return (
              <g key={d.date}>
                {d.in != null && (
                  <path d={barPath(cx - barW / 2, yOf(d.in), barW, baseY)} fill={SERIES} stroke="black" strokeWidth={1} />
                )}
                {d.target != null && (
                  <line
                    x1={cx - band / 2 + 1} x2={cx + band / 2 - 1} y1={yOf(d.target)} y2={yOf(d.target)}
                    stroke={REF} strokeWidth={1.5} strokeLinecap="round"
                  />
                )}
                <rect
                  x={box.left + band * i} y={box.top} width={band} height={plotH} fill="transparent"
                  onMouseMove={e => tip.show(e, <>{shortDate(d.date)}<br />in {fmt(d.in)} <span className="tt-muted">·</span> target {fmt(d.target)}</>)}
                  onMouseLeave={tip.hide}
                />
              </g>
            )
          })}
          <AxisText x={box.left} y={box.h - 6} anchor="start">{shortDate(series[0].date)}</AxisText>
          <AxisText x={box.w - box.right} y={box.h - 6} anchor="end">{shortDate(series[series.length - 1].date)}</AxisText>
        </>
      )}
    </ChartWrap>
  )
}

function TrainingChart({ f }: { f: FitnessSnapshot }) {
  const weeks = f.training_weeks || []
  const box = { w: 480, h: 150, left: 24, right: 6, top: 14, bottom: 20 }
  const plotW = box.w - box.left - box.right
  const plotH = box.h - box.top - box.bottom
  const baseY = box.top + plotH
  const band = weeks.length ? plotW / weeks.length : plotW
  const barW = Math.min(34, band * 0.6)
  const target = 7
  const yMax = Math.max(target + 2, ...weeks.map(w => w.sessions)) + 1
  const yOf = (v: number) => box.top + plotH * (1 - v / yMax)
  const step = Math.ceil(weeks.length / 8)
  return (
    <ChartWrap svgId="training-chart" viewBox="0 0 480 150" ariaLabel="Training sessions per week">
      {tip => weeks.length === 0 ? null : (
        <>
          {[5, 10].filter(v => v < yMax).map(v => (
            <g key={v}>
              <line x1={box.left} x2={box.w - box.right} y1={yOf(v)} y2={yOf(v)} stroke="#1a1a1a" strokeWidth={1} />
              <AxisText x={box.left - 5} y={yOf(v) + 3} anchor="end">{v}</AxisText>
            </g>
          ))}
          <line x1={box.left} x2={box.w - box.right} y1={baseY} y2={baseY} stroke="#333" strokeWidth={1} />
          <line
            x1={box.left} x2={box.w - box.right} y1={yOf(target)} y2={yOf(target)}
            stroke={REF} strokeWidth={1.5} strokeDasharray="5 4"
          />
          <AxisText x={box.w - box.right} y={yOf(target) - 4} anchor="end" color="#888">7/wk</AxisText>
          {weeks.map((wk, i) => {
            const cx = box.left + band * i + band / 2
            return (
              <g key={wk.week}>
                {wk.sessions > 0 && (
                  <path d={barPath(cx - barW / 2, yOf(wk.sessions), barW, baseY)} fill={SERIES} stroke="black" strokeWidth={1} />
                )}
                {(i % step === 0 || i === weeks.length - 1) && (
                  <AxisText x={cx} y={box.h - 6}>{wk.week.slice(5)}</AxisText>
                )}
                <rect
                  x={box.left + band * i} y={box.top} width={band} height={plotH} fill="transparent"
                  onMouseMove={e => tip.show(e, <>{wk.week}<br />{wk.sessions} session{wk.sessions === 1 ? '' : 's'}</>)}
                  onMouseLeave={tip.hide}
                />
              </g>
            )
          })}
        </>
      )}
    </ChartWrap>
  )
}

export function FitnessDomain({ f }: { f: FitnessSnapshot | null | undefined }) {
  const empty = f !== undefined && (!f || (!(f.weight_series || []).length && !(f.kcal_series || []).length))
  const series = f?.kcal_series || []
  const logged = series.filter(d => d.in != null).length
  const weeks = f?.training_weeks || []
  const w = f?.weight
  return (
    <section className="domain" id="fitness-domain">
      <h2 className="domain-title">fitness</h2>
      {!empty && (
        <>
          <div className="chart-block" id="weight-block">
            <div className="chart-head">
              <span>weight vs cut plan</span>
              <span className="chart-note" id="weight-note">
                {w && (f?.weight_series || []).length
                  ? `${w.current.toFixed(1)} kg · plan ${w.cut_target.toFixed(1)} by ${shortDate(w.cut_end_date)}`
                  : ''}
              </span>
            </div>
            {f ? <WeightChart f={f} /> : <ChartWrap svgId="weight-chart" viewBox="0 0 480 200" ariaLabel="Bodyweight over time against the cut plan">{() => null}</ChartWrap>}
            <p className="chart-caption" id="weight-caption">
              {w && (f?.weight_series || []).length
                ? 'dashed: straight-line plan (pace meter on the projects page is trip-aware)'
                : ''}
            </p>
          </div>
          <div className="chart-block" id="kcal-block">
            <div className="chart-head">
              <span>calories in, last 30 days</span>
              <span className="chart-note" id="kcal-note">
                {series.length ? `${logged}/${series.length} days logged` : ''}
              </span>
            </div>
            {f ? <KcalChart f={f} /> : null}
            <p className="chart-caption">bars: calories in · gray tick: day target · missing bar: unlogged day</p>
            <details>
              <summary>data</summary>
              <table id="kcal-table">
                <tbody>
                  {series.length > 0 && (
                    <tr>{['date', 'in', 'target'].map(h => <th key={h}>{h}</th>)}</tr>
                  )}
                  {series.map(d => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{fmt(d.in)}</td>
                      <td>{fmt(d.target)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
          <div className="chart-block" id="training-block">
            <div className="chart-head">
              <span>training sessions per week</span>
              <span className="chart-note" id="training-note">
                {weeks.length ? `this week ${weeks[weeks.length - 1].sessions}` : ''}
              </span>
            </div>
            {f ? <TrainingChart f={f} /> : null}
            <p className="chart-caption">gray line: 7 sessions/week goal</p>
          </div>
        </>
      )}
      {empty && <p className="empty-note" id="fitness-empty">No fitness snapshot yet.</p>}
    </section>
  )
}
