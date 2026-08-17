import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, clearToken, getToken } from '../shared/api'
import {
  activeProjects,
  boardCards,
  CALENDAR_SLUG,
  calendarCards,
  inboxCards,
  inToday,
  laneCells,
  localToday,
  signalsStale,
  TODAY_COLUMNS,
  todayLeft,
  type Card,
  type Project,
} from '../shared/board'
import { BoardGrid, CalendarRow, calendarCells, type GridRow } from '../shared/BoardGrid'
import { CardItem } from '../shared/CardItem'
import { CardPanel } from '../shared/CardPanel'
import { HeaderNav } from '../shared/HeaderNav'
import { LoginForm } from '../shared/LoginForm'
import { useBoard } from '../shared/useBoard'
import { useBoardActions } from '../shared/useBoardActions'
import { useCardDrag } from '../shared/useCardDrag'
import { WeekStrip } from '../shared/WeekStrip'

const NARROW = 720

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < NARROW : false))
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

export function AllPage() {
  const [view, setView] = useState<'boot' | 'login' | 'app'>(getToken() ? 'boot' : 'login')
  const [openId, setOpenId] = useState<string | null>(null)
  const [addProject, setAddProject] = useState<string>('')
  const [addDate, setAddDate] = useState<string>('')
  const addRef = useRef<HTMLInputElement>(null)
  const narrow = useNarrow()

  const showLogin = useCallback(() => {
    clearToken()
    setView('login')
  }, [])

  const board = useBoard(showLogin)
  const { data, status, load, recentlyMutated, reset, mutateWeek } = board
  const today = data ? data.today : localToday()
  const actions = useBoardActions(board, today, showLogin)

  const loadAll = useCallback(async () => {
    const authed = await load()
    if (authed) setView('app')
  }, [load])

  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    if (getToken()) loadAll()
    const refresh = () => {
      if (document.hidden || !getToken() || viewRef.current !== 'app') return
      if (recentlyMutated()) return
      loadAll()
    }
    document.addEventListener('visibilitychange', refresh)
    const id = setInterval(refresh, 60000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [loadAll, recentlyMutated])

  const projects = data ? activeProjects(data.registry) : []
  const rows: GridRow[] = projects
    .map((p: Project): GridRow => {
      const cells = laneCells(boardCards(data!.cards, p.slug), today).today
      return {
        id: p.slug,
        label: <a href={`/ub/board/${p.slug}/`} className="lane-link">{p.title}</a>,
        lane: 'today',
        project: p.slug,
        columns: TODAY_COLUMNS,
        cells,
        draggable: !narrow,
      }
    })
    .filter(row => TODAY_COLUMNS.some(c => row.cells[c].length > 0))

  const drag = useCardDrag(result => actions.drop(result, rows))

  const cal = data ? calendarCards(data.calendar, data.calendarDone, today, new Date(data.now)) : []
  const calToday = cal.filter(c => c.date === today)
  const inbox = data ? inboxCards(data.cards) : []
  const openCard = data && openId ? data.cards.find(c => c.id === openId) || null : null
  const stale = data ? signalsStale(data) : true
  const left = data ? todayLeft(data.cards, today) + calToday.filter(c => c.state !== 'done').length : 0

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const text = addRef.current!.value
    if (!text.trim()) return
    addRef.current!.value = ''
    actions.add({ text, project: addProject || null, date: addProject && addDate ? addDate : null })
    setAddDate('')
  }

  return (
    <main id="all-page" className={narrow ? 'narrow' : undefined}>
      <HeaderNav
        title="all"
        current="all"
        showLogout={view === 'app'}
        onLogout={async () => {
          try {
            await apiFetch('logout', { method: 'POST' })
          } catch {}
          reset()
          showLogin()
        }}
      />

      {view === 'login' && <LoginForm onSuccess={loadAll} />}

      {view === 'app' && data && (
        <section id="app-view">
          <WeekStrip weekGoals={data.weekGoals} notes={data.notes} mutateWeek={mutateWeek} />

          <div className="section-title" id="inbox-title">
            <span>inbox</span>
            <span id="inbox-count">{inbox.length ? `${inbox.length} to sort` : ''}</span>
          </div>
          <form id="add-form" onSubmit={submitAdd}>
            <input ref={addRef} id="add-input" placeholder="capture" maxLength={500} autoComplete="off" />
            <select id="add-project" value={addProject} onChange={e => setAddProject(e.target.value)} aria-label="Project">
              <option value="">inbox</option>
              {projects.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}
            </select>
            {addProject && (
              <input id="add-date" type="date" value={addDate} onChange={e => setAddDate(e.target.value)} aria-label="Date" />
            )}
            <button type="submit">Add</button>
          </form>
          <ul id="inbox-list" className="item-list">
            {inbox.map(card => (
              <CardItem key={card.id} card={card} today={today} onCycle={actions.cycle} onOpen={c => setOpenId(c.id)} />
            ))}
          </ul>

          <div className="section-title">
            <span>today</span>
            <span id="today-count">{left === 0 ? 'clear' : `${left} left`}</span>
          </div>

          {narrow ? (
            <div id="today-list">
              {calToday.length > 0 && (
                <div className="phone-group">
                  <div className="phone-group-label">calendar</div>
                  <ul className="item-list">
                    {[...calToday.filter(c => c.state !== 'done'), ...calToday.filter(c => c.state === 'done')].map(c => (
                      <li key={c.key} className={`card kind-event${c.state === 'done' ? ' done' : c.state === 'doing' ? ' doing' : ''}${c.ended && c.state !== 'done' ? ' event-past' : ''}`}>
                        <button className="todo-toggle" aria-label="Cycle event" onClick={() => actions.cycleCal(c, c.state === 'todo' ? 'doing' : c.state === 'doing' ? 'done' : 'todo')} />
                        <span className="todo-text">{c.ev.title}</span>
                        {!c.ev.allDay && <span className="event-time">{c.ev.start.slice(11, 16)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rows.map(row => {
                const cards: Card[] = [...row.cells.doing, ...row.cells.todo, ...row.cells.done]
                return (
                  <div key={row.id} className="phone-group">
                    <div className="phone-group-label">{row.label}</div>
                    <ul className="item-list">
                      {cards.map(card => (
                        <CardItem
                          key={card.id}
                          card={card}
                          today={today}
                          stale={stale && card.kind === 'auto-routine'}
                          onCycle={actions.cycle}
                          onOpen={c => setOpenId(c.id)}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })}
              {rows.length === 0 && calToday.length === 0 && <p id="empty-state">Nothing to do.</p>}
            </div>
          ) : (
            <BoardGrid
              today={today}
              rows={rows}
              stale={stale}
              columnsShown={TODAY_COLUMNS}
              draggingId={drag.draggingId}
              hoverCell={drag.hoverCell}
              previewIds={drag.previewIds}
              startDrag={drag.startDrag}
              onCycle={actions.cycle}
              onOpen={card => setOpenId(card.id)}
              extraRows={calToday.length > 0 ? (
                <CalendarRow
                  label={<a href={`/ub/board/${CALENDAR_SLUG}/`} className="lane-link">calendar</a>}
                  lane="today"
                  cells={calendarCells(calToday)}
                  columnsShown={TODAY_COLUMNS}
                  onCycle={actions.cycleCal}
                />
              ) : undefined}
            />
          )}
          {!narrow && rows.length === 0 && calToday.length === 0 && <p id="empty-state">Nothing to do.</p>}

          {stale && data.cards.some(c => c.kind === 'auto-routine' && inToday(c, today)) && (
            <p id="habit-note">
              signals stale{data.signals ? ` — snapshot from ${data.signals.date}` : ''}
            </p>
          )}

          <p id="sync-status" className={status.error ? 'error' : undefined}>{status.text}</p>

          {openCard && (
            <CardPanel
              card={openCard}
              registry={data.registry}
              today={today}
              onPatch={actions.patch}
              onDelete={card => {
                setOpenId(null)
                actions.remove(card)
              }}
              onClose={() => setOpenId(null)}
            />
          )}
        </section>
      )}
    </main>
  )
}
