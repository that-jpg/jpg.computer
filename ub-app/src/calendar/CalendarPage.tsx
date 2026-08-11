import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiGet, getToken, redirectToLogin, UnauthorizedError } from '../shared/api'
import { formatAsOf, pad, shortDate, timeLabel } from '../shared/format'
import type { Calendar, CalendarEvent, CalendarSnapshot } from '../shared/types'
import { addDays, alldayFor, fd, hourRange, layout, mondayOf, pd, timedFor, visibleEvents } from './logic'

const HOUR_PX = 44

function daysPerView(): number {
  return window.innerWidth < 640 ? 3 : 7
}

function initialViewStart(): Date {
  const today = pd(fd(new Date()))
  return daysPerView() === 7 ? mondayOf(today) : today
}

interface TooltipState {
  ev: CalendarEvent
  anchor: DOMRect
}

function Tooltip({ tip, cal, mainEl }: { tip: TooltipState; cal: Calendar | undefined; mainEl: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const mainRect = mainEl.getBoundingClientRect()
    let left = tip.anchor.left - mainRect.left
    const top = tip.anchor.bottom - mainRect.top + 6
    left = Math.min(left, mainRect.width - (ref.current?.offsetWidth ?? 0) - 4)
    setPos({ left: Math.max(0, left), top })
  }, [tip, mainEl])

  const ev = tip.ev
  return (
    <div
      id="tooltip"
      ref={ref}
      style={{ display: 'block', left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div>{ev.title}</div>
      <div className="tt-muted">
        {ev.allDay
          ? (ev.start === ev.end || ev.end <= ev.start
              ? ev.start
              : `${ev.start} → ${fd(addDays(pd(ev.end), -1))}`)
          : `${new Date(ev.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()} ${timeLabel(new Date(ev.start))}–${timeLabel(new Date(ev.end))}`}
      </div>
      {ev.location && <div className="tt-muted">{ev.location}</div>}
      {cal && <div className="tt-muted">{cal.name}</div>}
    </div>
  )
}

export function CalendarPage() {
  const [snap, setSnap] = useState<CalendarSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [viewStart, setViewStart] = useState<Date | null>(null)
  const [hiddenCals, setHiddenCals] = useState<ReadonlySet<string>>(new Set())
  const [tip, setTip] = useState<TooltipState | null>(null)
  const [, setTick] = useState(0)
  const mainRef = useRef<HTMLElement>(null)

  const load = useCallback(async () => {
    if (!getToken()) {
      redirectToLogin()
      return
    }
    try {
      const data = await apiGet<{ calendar: CalendarSnapshot | null }>('calendar')
      setSnap(data.calendar)
      setViewStart(prev => prev ?? initialViewStart())
      setFailed(false)
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        redirectToLogin()
        return
      }
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    const loadId = setInterval(load, 5 * 60 * 1000)
    const tickId = setInterval(() => setTick(t => t + 1), 60 * 1000)
    return () => {
      window.removeEventListener('focus', load)
      clearInterval(loadId)
      clearInterval(tickId)
    }
  }, [load])

  useEffect(() => {
    let lastLayout = daysPerView()
    const onResize = () => {
      if (daysPerView() !== lastLayout) {
        lastLayout = daysPerView()
        setViewStart(initialViewStart())
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const hide = () => setTip(null)
    document.addEventListener('click', hide)
    return () => document.removeEventListener('click', hide)
  }, [])

  const calById = (id: string) => (snap?.calendars || []).find(c => c.id === id)

  const days = snap && viewStart
    ? Array.from({ length: daysPerView() }, (_, i) => addDays(viewStart, i))
    : []
  const events = snap ? visibleEvents(snap, hiddenCals) : []
  const todayStr = fd(new Date())
  const [minHour, maxHour] = hourRange(days, events)
  const bodyHeight = (maxHour - minHour) * HOUR_PX
  const now = new Date()
  const nowH = now.getHours() + now.getMinutes() / 60
  const asOf = snap ? formatAsOf(snap.generated, Date.now()) : null

  const statusText = failed
    ? 'failed to load calendar'
    : !snap
      ? 'no calendar snapshot yet — waiting for the first push from aiur'
      : snap.errors?.length
        ? `partial data: ${snap.errors.join(' | ')}`
        : ''
  const statusError = failed || Boolean(snap && snap.errors?.length)

  const rangeFmt = (d: Date) => shortDate(d)
  const prevDisabled = !snap || !days.length || fd(addDays(days[0], -1)) < snap.window.start
  const nextDisabled = !snap || !days.length || fd(addDays(days[days.length - 1], 1)) > snap.window.end

  const showTip = (ev: CalendarEvent) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setTip({ ev, anchor: e.currentTarget.getBoundingClientRect() })
  }

  const sortedCals = snap
    ? [...(snap.calendars || [])].sort((a, b) =>
        Number(b.primary === true) - Number(a.primary === true) || a.name.localeCompare(b.name),
      )
    : []

  return (
    <main ref={mainRef}>
      <header>
        <h1>ub <em>calendar</em></h1>
        <nav>
          <a href="/ub/">today</a>
          <a href="/ub/projects/">projects</a>
          <a href="/ub/metrics/">metrics</a>
          <a href="/ub/calendar/" className="here">calendar</a>
        </nav>
      </header>

      <div id="toolbar">
        <button
          id="prev"
          aria-label="Previous"
          disabled={prevDisabled}
          onClick={() => setViewStart(v => v && addDays(v, -daysPerView()))}
        >
          &#8592;
        </button>
        <button id="today-btn" onClick={() => setViewStart(initialViewStart())}>today</button>
        <button
          id="next"
          aria-label="Next"
          disabled={nextDisabled}
          onClick={() => setViewStart(v => v && addDays(v, daysPerView()))}
        >
          &#8594;
        </button>
        <span id="range-label">
          {days.length ? `${rangeFmt(days[0])} – ${rangeFmt(days[days.length - 1])}` : ''}
        </span>
        <span id="as-of" className={asOf?.stale ? 'stale' : undefined}>{asOf?.text ?? ''}</span>
      </div>

      <div id="cal" style={days.length ? { gridTemplateColumns: `48px repeat(${days.length}, 1fr)` } : undefined}>
        {days.length > 0 && (
          <>
            <div />
            {days.map(day => (
              <div key={`h-${fd(day)}`} className={`head-cell${fd(day) === todayStr ? ' today' : ''}`}>
                {day.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()}
                <strong>{day.getDate()}</strong>
              </div>
            ))}
            <div />
            {days.map(day => (
              <div key={`a-${fd(day)}`} className="allday-cell">
                {alldayFor(events, fd(day)).map((ev, i) => (
                  <div
                    key={`${ev.cal}-${ev.title}-${i}`}
                    className="allday-chip"
                    style={{ background: calById(ev.cal)?.color ?? '#888' }}
                    onClick={showTip(ev)}
                  >
                    {ev.title}
                  </div>
                ))}
              </div>
            ))}
            <div className="axis" style={{ height: bodyHeight }}>
              {Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i).map(h => (
                <span key={h} className="axis-label" style={{ top: (h - minHour) * HOUR_PX }}>
                  {pad(h)}:00
                </span>
              ))}
            </div>
            {days.map(day => (
              <div
                key={`d-${fd(day)}`}
                className={`day-col${fd(day) === todayStr ? ' today' : ''}`}
                style={{ height: bodyHeight }}
              >
                {Array.from({ length: maxHour - minHour - 1 }, (_, i) => minHour + 1 + i).map(h => (
                  <div key={h} className="hour-line" style={{ top: (h - minHour) * HOUR_PX }} />
                ))}
                {layout(timedFor(events, day)).map((item, i) => {
                  const startDate = new Date(item.s)
                  const hs = startDate.getHours() + startDate.getMinutes() / 60
                  const durationH = (item.e - item.s) / 3600000
                  return (
                    <div
                      key={i}
                      className="event"
                      style={{
                        background: calById(item.ev.cal)?.color ?? '#888',
                        top: (hs - minHour) * HOUR_PX,
                        height: Math.max(16, durationH * HOUR_PX - 2),
                        left: `${(item.col / item.ncols) * 100}%`,
                        width: `calc(${100 / item.ncols}% - 2px)`,
                      }}
                      onClick={showTip(item.ev)}
                    >
                      <span>{item.ev.title}</span>
                      {durationH * HOUR_PX >= 34 && (
                        <span className="ev-time">{timeLabel(new Date(item.ev.start))}</span>
                      )}
                    </div>
                  )
                })}
                {fd(day) === todayStr && nowH >= minHour && nowH <= maxHour && (
                  <div id="now-line" style={{ top: (nowH - minHour) * HOUR_PX }} />
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div id="legend">
        {sortedCals.map(cal => (
          <span
            key={cal.id}
            className={`legend-item${hiddenCals.has(cal.id) ? ' off' : ''}`}
            onClick={() => {
              setHiddenCals(prev => {
                const next = new Set(prev)
                if (next.has(cal.id)) next.delete(cal.id)
                else next.add(cal.id)
                return next
              })
            }}
          >
            <span className="legend-dot" style={{ background: cal.color }} />
            <span>{cal.name}</span>
          </span>
        ))}
      </div>

      <p id="status" className={statusError ? 'error' : undefined}>{statusText}</p>
      {tip && mainRef.current && (
        <Tooltip tip={tip} cal={calById(tip.ev.cal)} mainEl={mainRef.current} />
      )}
    </main>
  )
}
