import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { linePath, REF, SERIES, shortDate, type Point, type TimeScale } from './chartMath'

export interface ChartTip {
  show: (e: React.MouseEvent, content: ReactNode) => void
  hide: () => void
}

export function ChartWrap({
  viewBox,
  ariaLabel,
  svgId,
  children,
}: {
  viewBox: string
  ariaLabel: string
  svgId?: string
  children: (tip: ChartTip) => ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ content: ReactNode; clientX: number; clientY: number } | null>(null)

  useLayoutEffect(() => {
    if (!tip || !wrapRef.current || !tipRef.current) return
    const wrap = wrapRef.current.getBoundingClientRect()
    const ttW = tipRef.current.offsetWidth
    let px = tip.clientX - wrap.left + 12
    if (px + ttW > wrap.width) px = tip.clientX - wrap.left - ttW - 12
    tipRef.current.style.left = `${Math.max(0, px)}px`
    tipRef.current.style.top = `${tip.clientY - wrap.top - 10}px`
  }, [tip])

  const api: ChartTip = {
    show: (e, content) => setTip({ content, clientX: e.clientX, clientY: e.clientY }),
    hide: () => setTip(null),
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg id={svgId} viewBox={viewBox} role="img" aria-label={ariaLabel}>
        {children(api)}
      </svg>
      <div className="chart-tooltip" ref={tipRef} style={{ display: tip ? 'block' : 'none' }}>
        {tip?.content}
      </div>
    </div>
  )
}

export function AxisText({
  x,
  y,
  anchor = 'middle',
  color = '#666',
  children,
}: {
  x: number
  y: number
  anchor?: 'start' | 'middle' | 'end'
  color?: string
  children: ReactNode
}) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={9}
      textAnchor={anchor}
      style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
    >
      {children}
    </text>
  )
}

export function TimeFrame({
  c,
  xMin,
  xMax,
  yGrid = [],
  yFmt,
}: {
  c: TimeScale
  xMin: string
  xMax: string
  yGrid?: number[]
  yFmt?: (v: number) => string
}) {
  return (
    <>
      {yGrid.map(g => (
        <g key={g}>
          <line x1={c.box.left} x2={c.box.w - c.box.right} y1={c.yOf(g)} y2={c.yOf(g)} stroke="#1a1a1a" strokeWidth={1} />
          <AxisText x={c.box.left - 5} y={c.yOf(g) + 3} anchor="end">{yFmt ? yFmt(g) : g}</AxisText>
        </g>
      ))}
      <line x1={c.box.left} x2={c.box.w - c.box.right} y1={c.baseY} y2={c.baseY} stroke="#333" strokeWidth={1} />
      <AxisText x={c.box.left} y={c.box.h - 6} anchor="start">{shortDate(xMin)}</AxisText>
      <AxisText x={c.box.w - c.box.right} y={c.box.h - 6} anchor="end">{shortDate(xMax)}</AxisText>
    </>
  )
}

export function RefLine({ points, label }: { points: Point[]; label?: string }) {
  return (
    <>
      <path d={linePath(points)} fill="none" stroke={REF} strokeWidth={1.5} strokeDasharray="5 4" strokeLinecap="round" />
      {label && (
        <AxisText x={points[points.length - 1][0]} y={points[points.length - 1][1] - 5} anchor="end" color="#888">
          {label}
        </AxisText>
      )}
    </>
  )
}

export function SeriesLine({ points, markers = true }: { points: Point[]; markers?: boolean }) {
  return (
    <>
      {points.length > 1 && (
        <path d={linePath(points)} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {markers && points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={points.length > 40 ? 1.5 : 2.5} fill={SERIES} stroke="black" strokeWidth={1} />
      ))}
    </>
  )
}

export function HoverBands<T>({
  entries,
  height,
  tip,
  content,
}: {
  entries: { x: number; p: T }[]
  height: number
  tip: ChartTip
  content: (p: T) => ReactNode
}) {
  const xs = entries.map(e => e.x)
  return (
    <>
      {entries.map((entry, i) => {
        const left = i === 0 ? 0 : (xs[i - 1] + xs[i]) / 2
        const right = i === entries.length - 1 ? 480 : (xs[i] + xs[i + 1]) / 2
        return (
          <rect
            key={i}
            x={left}
            y={0}
            width={right - left}
            height={height}
            fill="transparent"
            onMouseMove={e => tip.show(e, content(entry.p))}
            onMouseLeave={tip.hide}
          />
        )
      })}
    </>
  )
}
