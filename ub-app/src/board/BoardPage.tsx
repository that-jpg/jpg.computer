import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, clearToken, getToken } from '../shared/api'
import {
  activeProjects,
  boardCards,
  CALENDAR_SLUG,
  calendarCards,
  COLUMNS,
  laneCells,
  localToday,
  openCount,
  projectOf,
  projectsByOrder,
  signalsStale,
  TODAY_COLUMNS,
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
import { TemplatesEditor } from './TemplatesEditor'

const NARROW = 720

export function slugFromPath(pathname: string): string {
  const match = pathname.match(/\/ub\/board\/([a-z0-9-]+)\/?/)
  return match ? match[1] : ''
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < NARROW : false))
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

function NoteEditor({ project, onSave }: { project: Project; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  if (!editing) {
    return (
      <span className="board-note" onClick={() => setEditing(true)}>
        {project.note || <em>add a note</em>}
      </span>
    )
  }
  return (
    <input
      ref={ref}
      className="board-note-edit"
      defaultValue={project.note}
      maxLength={200}
      autoFocus
      onBlur={() => {
        const note = ref.current!.value.replace(/\s+/g, ' ').trim()
        setEditing(false)
        if (note !== project.note) onSave(note)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ref.current!.blur()
        }
        if (e.key === 'Escape') {
          ref.current!.value = project.note
          ref.current!.blur()
        }
      }}
    />
  )
}

export function BoardPage({ slug: slugProp }: { slug?: string }) {
  const slug = slugProp ?? slugFromPath(typeof location !== 'undefined' ? location.pathname : '')
  const [view, setView] = useState<'boot' | 'login' | 'app'>(getToken() ? 'boot' : 'login')
  const [openId, setOpenId] = useState<string | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(() =>
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('templates') === '1')
  const [addDate, setAddDate] = useState('')
  const addRef = useRef<HTMLInputElement>(null)
  const narrow = useNarrow()

  const showLogin = useCallback(() => {
    clearToken()
    setView('login')
  }, [])

  const board = useBoard(showLogin)
  const { data, status, load, recentlyMutated, reset, mutateRegistry } = board
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

  const isCalendar = slug === CALENDAR_SLUG
  const project = data ? projectOf(data.registry, slug) : null
  const cards = data && project ? boardCards(data.cards, project.slug) : []
  const cells = laneCells(cards, today)
  const readOnly = Boolean(project && project.status === 'archived')

  const rows: GridRow[] = project
    ? [
        {
          id: 'today',
          label: 'today',
          lane: 'today',
          project: project.slug,
          columns: TODAY_COLUMNS,
          cells: cells.today,
          draggable: !narrow && !readOnly,
        },
        {
          id: 'later',
          label: 'later',
          lane: 'later',
          project: project.slug,
          columns: COLUMNS,
          cells: cells.later,
          draggable: !narrow && !readOnly,
        },
      ]
    : []

  const cal = data && isCalendar ? calendarCards(data.calendar, data.calendarDone, today, new Date(data.now)) : []
  const calToday = cal.filter(c => c.date === today)
  const calLater = cal.filter(c => c.date > today)
  const drag = useCardDrag(result => actions.drop(result, rows, cal))
  const openCard = data && openId ? data.cards.find(c => c.id === openId) || null : null
  const stale = data ? signalsStale(data) : true
  const title = isCalendar ? 'calendar' : project ? project.title : slug || 'board'

  const patchProject = (fields: Record<string, unknown>) => {
    if (!project) return
    mutateRegistry(
      'projects',
      { method: 'PATCH', body: JSON.stringify({ slug: project.slug, ...fields }) },
      prev => ({ ...prev, projects: prev.projects.map(p => (p.slug === project.slug ? { ...p, ...fields } as Project : p)) }),
    )
  }

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return
    const text = addRef.current!.value
    if (!text.trim()) return
    addRef.current!.value = ''
    actions.add({ text, project: project.slug, date: addDate || null })
    setAddDate('')
  }

  return (
    <main id="board-page" className={narrow ? 'narrow' : undefined}>
      <HeaderNav
        title={title}
        current="boards"
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
          <div id="board-head">
            <div id="board-switch">
              <select
                value={slug}
                aria-label="Switch board"
                onChange={e => { location.href = `/ub/board/${e.target.value}/` }}
              >
                <option value={CALENDAR_SLUG}>calendar</option>
                {projectsByOrder(data.registry).filter(p => p.status !== 'archived' || p.slug === slug).map(p => (
                  <option key={p.slug} value={p.slug}>{p.title}{p.status !== 'active' ? ` (${p.status})` : ''}</option>
                ))}
              </select>
              <a href="/ub/boards/" className="board-all-link">all boards</a>
            </div>
            {project && (
              <>
                <div id="board-meta">
                  <span className="board-prefix">{project.prefix}</span>
                  <NoteEditor project={project} onSave={note => patchProject({ note })} />
                  <span className="board-count">{openCount(cards)} open</span>
                  {project.slug === 'fisica3' && <a href="/ub/fisica3/" className="board-all-link">ledger</a>}
                </div>
                <div id="board-controls">
                  <select
                    value={project.status}
                    aria-label="Board status"
                    onChange={e => patchProject({ status: e.target.value })}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="archived">archived</option>
                  </select>
                  <button
                    id="templates-toggle"
                    className={templatesOpen ? 'active' : undefined}
                    onClick={() => setTemplatesOpen(v => !v)}
                  >
                    routines ({project.templates.length})
                  </button>
                </div>
              </>
            )}
          </div>

          {project && templatesOpen && <TemplatesEditor project={project} mutateRegistry={mutateRegistry} />}

          {project && !readOnly && (
            <form id="add-form" onSubmit={submitAdd}>
              <input ref={addRef} id="add-input" placeholder={`new ${project.prefix} card`} maxLength={500} autoComplete="off" />
              <input id="add-date" type="date" value={addDate} onChange={e => setAddDate(e.target.value)} aria-label="Date" />
              <button type="submit">Add</button>
            </form>
          )}

          {!project && !isCalendar && <p id="empty-state">no board called “{slug}”</p>}

          {isCalendar && (
            narrow ? (
              <div id="today-list">
                {[['today', calToday], ['upcoming', calLater]].map(([label, list]) => (
                  <div key={label as string} className="phone-group">
                    <div className="phone-group-label">{label as string}</div>
                    <ul className="item-list">
                      {(list as typeof cal).map(c => (
                        <li
                          key={`${c.date}|${c.key}`}
                          className={`card kind-event tappable${c.state === 'done' ? ' done' : c.state === 'doing' ? ' doing' : ''}`}
                          onClick={() => actions.cycleCal(c, c.state === 'todo' ? 'doing' : c.state === 'doing' ? 'done' : 'todo')}
                        >
                          <div className="card-line"><span className="todo-text">{c.ev.title}</span></div>
                          <div className="card-meta">
                            <span className="event-time">{c.date === today ? c.ev.start.slice(11, 16) : c.date.slice(5)}</span>
                            <span className="event-state">{c.state}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <BoardGrid
                today={today}
                rows={[]}
                columnsShown={COLUMNS}
                draggingId={drag.draggingId}
                hoverCell={drag.hoverCell}
                previewIds={drag.previewIds}
                startDrag={drag.startDrag}
                onOpen={() => {}}
                extraRows={
                  <>
                    <CalendarRow id="cal-today" label="today" lane="today" cells={calendarCells(calToday)} draggingId={drag.draggingId} hoverCell={drag.hoverCell} startDrag={drag.startDrag} />
                    <CalendarRow id="cal-later" label="later" lane="later" cells={calendarCells(calLater)} draggingId={drag.draggingId} hoverCell={drag.hoverCell} startDrag={drag.startDrag} />
                  </>
                }
              />
            )
          )}

          {project && (
            narrow ? (
              <div id="today-list">
                {[['today', [...cells.today.doing, ...cells.today.todo, ...cells.today.done]], ['later', [...cells.later.doing, ...cells.later.todo, ...cells.later.backlog]]].map(([label, list]) => (
                  <div key={label as string} className="phone-group">
                    <div className="phone-group-label">{label as string}</div>
                    <ul className="item-list">
                      {(list as typeof cards).map(card => (
                        <CardItem
                          key={card.id}
                          card={card}
                          today={today}
                          stale={stale && card.kind === 'auto-routine'}
                          onOpen={c => setOpenId(c.id)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <BoardGrid
                today={today}
                rows={rows}
                stale={stale}
                columnsShown={COLUMNS}
                draggingId={drag.draggingId}
                hoverCell={drag.hoverCell}
                previewIds={drag.previewIds}
                startDrag={drag.startDrag}
                onOpen={card => setOpenId(card.id)}
              />
            )
          )}

          {project && cards.length === 0 && <p id="empty-state">empty board</p>}

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

export function activeSlugs(registry: Parameters<typeof activeProjects>[0]): string[] {
  return activeProjects(registry).map(p => p.slug)
}
