import type { FinanceMonth, FinanceSnapshot } from '../shared/types'
import { BRL_FMT, OTHER_COLOR, shortDate, SPEND_COLORS, spendCategories, timeScale } from './chartMath'
import { AxisText, ChartWrap, HoverBands, SeriesLine, TimeFrame } from './charts'

function NetWorthChart({ f }: { f: FinanceSnapshot }) {
  const series = f.net_worth!.series
  const totals = series.map(p => p.total)
  let yMin = Math.min(...totals)
  let yMax = Math.max(...totals)
  if (yMin === yMax) {
    yMin -= 1
    yMax += 1
  }
  const pad = (yMax - yMin) * 0.18
  const c = timeScale({
    h: 140,
    xMin: series[0].date,
    xMax: series[series.length - 1].date,
    yMin: yMin - pad,
    yMax: yMax + pad,
  })
  const last = series[series.length - 1]
  return (
    <ChartWrap svgId="networth-chart" viewBox="0 0 480 140" ariaLabel="Net worth per statement date">
      {tip => (
        <>
          <TimeFrame c={c} xMin={series[0].date} xMax={series[series.length - 1].date} />
          <SeriesLine points={series.map(p => [c.xOf(p.date), c.yOf(p.total)])} />
          <AxisText x={480 - c.box.right} y={Math.max(c.yOf(last.total) - 8, 10)} anchor="end" color="#e2e8f0">
            {BRL_FMT.format(last.total)}
          </AxisText>
          <HoverBands
            entries={series.map(p => ({ x: c.xOf(p.date), p }))}
            height={c.box.h}
            tip={tip}
            content={p => <>{shortDate(p.date)}<br />{BRL_FMT.format(p.total)}</>}
          />
        </>
      )}
    </ChartWrap>
  )
}

function monthSegments(m: FinanceMonth, cats: string[]): [string, number][] {
  const entries = Object.entries(m.by_category || {})
  const named = entries.filter(([name]) => cats.includes(name))
  const otherSum = entries.filter(([name]) => !cats.includes(name)).reduce((sum, [, v]) => sum + v, 0)
  return [...named, ...(otherSum > 0 ? [['other', otherSum] as [string, number]] : [])]
}

function SpendChart({ months, cats }: { months: FinanceMonth[]; cats: string[] }) {
  const colorOf = (name: string) => {
    const i = cats.indexOf(name)
    return i === -1 ? OTHER_COLOR : SPEND_COLORS[i]
  }
  const box = { w: 480, h: 170, left: 40, right: 6, top: 14, bottom: 20 }
  const plotW = box.w - box.left - box.right
  const plotH = box.h - box.top - box.bottom
  const baseY = box.top + plotH
  const band = plotW / months.length
  const barW = Math.min(46, band * 0.55)
  const yMax = Math.max(...months.map(m => m.spend)) * 1.12
  const yOf = (v: number) => box.top + plotH * (1 - v / yMax)
  const gridVals: number[] = []
  for (let v = 5000; v < yMax; v += 5000) gridVals.push(v)
  return (
    <ChartWrap svgId="spend-chart" viewBox="0 0 480 170" ariaLabel="Monthly spending stacked by category">
      {tip => (
        <>
          <line x1={box.left} x2={box.w - box.right} y1={baseY} y2={baseY} stroke="#333" strokeWidth={1} />
          {months.map((m, i) => {
            const cx = box.left + band * i + band / 2
            const segments = monthSegments(m, cats)
            let acc = 0
            const rects = segments.map(([name, value]) => {
              const y0 = yOf(acc)
              const y1 = yOf(acc + value)
              acc += value
              return (
                <rect
                  key={name}
                  x={cx - barW / 2} y={y1} width={barW} height={Math.max(y0 - y1, 0.5)}
                  fill={name === 'other' ? OTHER_COLOR : colorOf(name)}
                  stroke="black" strokeWidth={1}
                />
              )
            })
            return (
              <g key={m.month}>
                {rects}
                <AxisText x={cx} y={yOf(m.spend) - 5} color="#e2e8f0">{BRL_FMT.format(m.spend)}</AxisText>
                <AxisText x={cx} y={box.h - 6}>{m.month.slice(2)}</AxisText>
                <rect
                  x={box.left + band * i} y={0} width={band} height={box.h} fill="transparent"
                  onMouseMove={e => tip.show(e, (
                    <>
                      {m.month} · spend {BRL_FMT.format(m.spend)}
                      {segments.map(([name, value]) => (
                        <span key={name}><br />{name} <span className="tt-muted">{BRL_FMT.format(value)}</span></span>
                      ))}
                    </>
                  ))}
                  onMouseLeave={tip.hide}
                />
              </g>
            )
          })}
          {gridVals.map(v => (
            <AxisText key={v} x={box.left - 5} y={yOf(v) + 3} anchor="end">{Math.round(v / 1000)}k</AxisText>
          ))}
        </>
      )}
    </ChartWrap>
  )
}

export function FinanceDomain({ f }: { f: FinanceSnapshot | null | undefined }) {
  const hasData = Boolean(
    f && f.net_worth
    && ((f.net_worth.series || []).length > 0
      || (f.months || []).some(m => m.spend > 0 || m.income > 0)),
  )
  const months = (f?.months || []).filter(m => m.spend > 0 || m.income > 0)
  const cats = spendCategories(months)
  const allocEntries = Object.entries(f?.allocation || {})
  return (
    <section className="domain" id="finance-domain">
      <h2 className="domain-title">finance</h2>
      {f !== undefined && !hasData && (
        <p className="empty-note" id="finance-empty">
          No statements ingested yet — send a PDF or CSV export from XP, BTG,
          or Nubank to Bune on Telegram and approve the preview.
        </p>
      )}
      {hasData && f && (
        <div id="finance-body">
          <div className="chart-block">
            <div className="chart-head">
              <span>net worth per statement date</span>
              <span className="chart-note" id="networth-note">
                {(f.net_worth!.series || []).length > 0
                  ? BRL_FMT.format(f.net_worth!.total)
                  : 'no balance statements yet'}
              </span>
            </div>
            {(f.net_worth!.series || []).length > 0 && <NetWorthChart f={f} />}
          </div>
          <div className="chart-block">
            <div className="chart-head">
              <span>monthly spending by category</span>
              <span className="chart-note" id="spend-note">
                {months.length === 0 ? 'no transactions yet' : `${months.length} month${months.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {months.length > 0 && <SpendChart months={months} cats={cats} />}
            <div className="legend" id="spend-legend">
              {months.length > 0 && [...cats, 'other'].map((name, i) => (
                <span key={name}>
                  <span
                    className="dot"
                    style={{ background: name === 'other' || i >= SPEND_COLORS.length ? OTHER_COLOR : SPEND_COLORS[i] }}
                  />
                  {name}
                </span>
              ))}
            </div>
          </div>
          {allocEntries.length > 0 && (
            <div className="chart-block" id="alloc-block">
              <div className="chart-head"><span>allocation</span></div>
              <div id="alloc-bar">
                {allocEntries.map(([name, entry], i) => (
                  <div
                    key={name}
                    style={{
                      width: `${entry.share}%`,
                      background: i < SPEND_COLORS.length ? SPEND_COLORS[i] : OTHER_COLOR,
                    }}
                  />
                ))}
              </div>
              <div className="legend" id="alloc-legend">
                {allocEntries.map(([name, entry], i) => (
                  <span key={name}>
                    <span className="dot" style={{ background: i < SPEND_COLORS.length ? SPEND_COLORS[i] : OTHER_COLOR }} />
                    {name} {Math.round(entry.share)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
