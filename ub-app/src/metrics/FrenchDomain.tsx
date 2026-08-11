import type { FrenchSnapshot } from '../shared/types'
import { barPath, fillDays, REF, rollingAccuracy, SERIES, shortDate, timeScale, type Point } from './chartMath'
import { AxisText, ChartWrap, HoverBands, RefLine, SeriesLine, TimeFrame } from './charts'

function AccuracyChart({ f }: { f: FrenchSnapshot }) {
  const rolling = rollingAccuracy(f.accuracy_series || [])
  const withData = rolling.filter(p => p.pct != null)
  if (withData.length === 0) {
    return (
      <ChartWrap svgId="accuracy-chart" viewBox="0 0 480 150" ariaLabel="7-day rolling review accuracy">
        {() => null}
      </ChartWrap>
    )
  }
  const c = timeScale({ h: 150, xMin: rolling[0].date, xMax: rolling[rolling.length - 1].date, yMin: 0, yMax: 100 })
  const segments: Point[][] = []
  let segment: Point[] = []
  for (const p of rolling) {
    if (p.pct == null) {
      if (segment.length) segments.push(segment)
      segment = []
    } else {
      segment.push([c.xOf(p.date), c.yOf(p.pct)])
    }
  }
  if (segment.length) segments.push(segment)
  const lastPt = withData[withData.length - 1]
  return (
    <ChartWrap svgId="accuracy-chart" viewBox="0 0 480 150" ariaLabel="7-day rolling review accuracy">
      {tip => (
        <>
          <TimeFrame
            c={c}
            xMin={rolling[0].date}
            xMax={rolling[rolling.length - 1].date}
            yGrid={[50, 80, 100]}
            yFmt={v => `${v}%`}
          />
          <line
            x1={c.box.left} x2={480 - c.box.right} y1={c.yOf(80)} y2={c.yOf(80)}
            stroke={REF} strokeWidth={1.5} strokeDasharray="5 4"
          />
          {segments.map((seg, i) => <SeriesLine key={i} points={seg} markers={false} />)}
          <AxisText x={c.xOf(lastPt.date)} y={c.yOf(lastPt.pct!) - 6} anchor="end" color="#e2e8f0">
            {Math.round(lastPt.pct!)}%
          </AxisText>
          <HoverBands
            entries={rolling.map(p => ({ x: c.xOf(p.date), p }))}
            height={c.box.h}
            tip={tip}
            content={p =>
              p.pct == null
                ? <>{shortDate(p.date)}<br /><span className="tt-muted">no reviews in window</span></>
                : <>{shortDate(p.date)}<br />{Math.round(p.pct)}% over {p.reviews} reviews</>}
          />
        </>
      )}
    </ChartWrap>
  )
}

function ReviewsChart({ f }: { f: FrenchSnapshot }) {
  const series = f.accuracy_series || []
  const quota = f.today && f.today.quota ? f.today.quota : 10
  const days = fillDays(series)
  const box = { w: 480, h: 140, left: 24, right: 6, top: 14, bottom: 20 }
  const plotW = box.w - box.left - box.right
  const plotH = box.h - box.top - box.bottom
  const baseY = box.top + plotH
  const band = days.length ? plotW / days.length : plotW
  const barW = Math.min(12, band * 0.62)
  const yMax = Math.max(quota + 4, ...days.map(d => d.reviews)) + 2
  const yOf = (v: number) => box.top + plotH * (1 - v / yMax)
  return (
    <ChartWrap svgId="reviews-chart" viewBox="0 0 480 140" ariaLabel="Anki reviews per day">
      {tip => days.length === 0 ? null : (
        <>
          <line x1={box.left} x2={box.w - box.right} y1={baseY} y2={baseY} stroke="#333" strokeWidth={1} />
          <line
            x1={box.left} x2={box.w - box.right} y1={yOf(quota)} y2={yOf(quota)}
            stroke={REF} strokeWidth={1.5} strokeDasharray="5 4"
          />
          <AxisText x={box.w - box.right} y={yOf(quota) - 4} anchor="end" color="#888">quota {quota}</AxisText>
          {days.map((d, i) => {
            const cx = box.left + band * i + band / 2
            const pct = d.reviews ? ` · ${Math.round(100 * d.correct / d.reviews)}% correct` : ''
            return (
              <g key={d.date}>
                {d.reviews > 0 && (
                  <path d={barPath(cx - barW / 2, yOf(d.reviews), barW, baseY)} fill={SERIES} stroke="black" strokeWidth={1} />
                )}
                <rect
                  x={box.left + band * i} y={box.top} width={band} height={plotH} fill="transparent"
                  onMouseMove={e => tip.show(e, <>{shortDate(d.date)}<br />{d.reviews} review{d.reviews === 1 ? '' : 's'}{pct}</>)}
                  onMouseLeave={tip.hide}
                />
              </g>
            )
          })}
          <AxisText x={box.left} y={box.h - 6} anchor="start">{shortDate(days[0].date)}</AxisText>
          <AxisText x={box.w - box.right} y={box.h - 6} anchor="end">{shortDate(days[days.length - 1].date)}</AxisText>
        </>
      )}
    </ChartWrap>
  )
}

function VocabSeries({ f }: { f: FrenchSnapshot }) {
  const series = f.vocab_series || []
  if (series.length < 2) {
    return (
      <p className="empty-note" id="vocab-series-empty">
        {series.length === 1
          ? `words-known series started ${shortDate(series[0].date)} — the line appears with the second daily point.`
          : 'words-known series starts with the first producer push.'}
      </p>
    )
  }
  const yMax = Math.max(...series.map(p => p.introduced)) + 5
  const c = timeScale({ h: 140, xMin: series[0].date, xMax: series[series.length - 1].date, yMin: 0, yMax })
  return (
    <div className="chart-block" id="vocab-series-block">
      <div className="chart-head">
        <span>words known over time</span>
        <span className="chart-note" id="vocab-series-note">{series[series.length - 1].known} known</span>
      </div>
      <ChartWrap svgId="vocab-chart" viewBox="0 0 480 140" ariaLabel="Vocabulary known over time">
        {tip => (
          <>
            <TimeFrame
              c={c}
              xMin={series[0].date}
              xMax={series[series.length - 1].date}
              yGrid={[Math.round(yMax / 2)]}
            />
            <RefLine points={series.map(p => [c.xOf(p.date), c.yOf(p.introduced)])} label="introduced" />
            <SeriesLine points={series.map(p => [c.xOf(p.date), c.yOf(p.known)])} markers={false} />
            <HoverBands
              entries={series.map(p => ({ x: c.xOf(p.date), p }))}
              height={c.box.h}
              tip={tip}
              content={p => <>{shortDate(p.date)}<br />{p.known} known <span className="tt-muted">·</span> {p.introduced} introduced</>}
            />
          </>
        )}
      </ChartWrap>
    </div>
  )
}

export function FrenchDomain({ f }: { f: FrenchSnapshot | null | undefined }) {
  const empty = f !== undefined && (!f || !f.vocab)
  return (
    <section className="domain" id="french-domain">
      <h2 className="domain-title">french</h2>
      {!empty && f && (
        <>
          <div className="stat-row" id="vocab-tiles">
            <div>
              <span className="stat-label">words known</span>
              <span className="stat-value" id="vocab-known">{f.vocab!.known} / {f.vocab!.total}</span>
              <span className="stat-sub" id="vocab-sub">{f.vocab!.introduced} introduced</span>
            </div>
            <div>
              <span className="stat-label">today</span>
              <span className="stat-value" id="french-today">{f.today.reviews}</span>
              <span className="stat-sub" id="french-today-sub">reviews today · quota {f.today.quota} new</span>
            </div>
          </div>
          <div className="chart-block" id="accuracy-block">
            <div className="chart-head">
              <span>review accuracy, 7-day rolling</span>
              <span className="chart-note" id="accuracy-note">
                {(() => {
                  const withData = rollingAccuracy(f.accuracy_series || []).filter(p => p.pct != null)
                  return withData.length ? `now ${Math.round(withData[withData.length - 1].pct!)}%` : ''
                })()}
              </span>
            </div>
            <AccuracyChart f={f} />
            <p className="chart-caption">gray line: 80% month-end goal</p>
          </div>
          <div className="chart-block" id="reviews-block">
            <div className="chart-head">
              <span>reviews per day</span>
              <span className="chart-note" id="reviews-note"></span>
            </div>
            <ReviewsChart f={f} />
            <p className="chart-caption" id="reviews-caption">
              gray line: daily new-card quota ({f.today && f.today.quota ? f.today.quota : 10})
            </p>
          </div>
          <VocabSeries f={f} />
        </>
      )}
      {empty && <p className="empty-note" id="french-empty">No french snapshot yet.</p>}
    </section>
  )
}
