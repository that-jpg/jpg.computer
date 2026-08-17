import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, clearToken, getToken } from '../shared/api'
import { boardCards, localToday, openCount, projectsByOrder, type AwayRange, type Project, type Registry } from '../shared/board'
import { HeaderNav } from '../shared/HeaderNav'
import { LoginForm } from '../shared/LoginForm'
import { useBoard } from '../shared/useBoard'

function defaultPrefix(slug: string): string {
  const letters = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return /^[A-Z]/.test(letters) ? letters : `P${letters}`.slice(0, 8)
}

export function BoardsPage() {
  const [view, setView] = useState<'boot' | 'login' | 'app'>(getToken() ? 'boot' : 'login')
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [prefix, setPrefix] = useState('')
  const [prefixTouched, setPrefixTouched] = useState(false)
  const [awayStart, setAwayStart] = useState('')
  const [awayEnd, setAwayEnd] = useState('')
  const [formError, setFormError] = useState('')
  const slugRef = useRef<HTMLInputElement>(null)

  const showLogin = useCallback(() => {
    clearToken()
    setView('login')
  }, [])

  const board = useBoard(showLogin)
  const { data, status, load, recentlyMutated, reset, mutateRegistry } = board
  const today = data ? data.today : localToday()

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
    const id = setInterval(refresh, 120000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [loadAll, recentlyMutated])

  const projects = data ? projectsByOrder(data.registry) : []

  const patchProject = (p: Project, fields: Partial<Project>) =>
    mutateRegistry(
      'projects',
      { method: 'PATCH', body: JSON.stringify({ slug: p.slug, ...fields }) },
      prev => ({ ...prev, projects: prev.projects.map(x => (x.slug === p.slug ? { ...x, ...fields } : x)) }),
    )

  const move = (p: Project, delta: number) => {
    const order = projects.map(x => x.slug)
    const idx = order.indexOf(p.slug)
    const target = idx + delta
    if (target < 0 || target >= order.length) return
    order.splice(idx, 1)
    order.splice(target, 0, p.slug)
    mutateRegistry(
      'projects-order',
      { method: 'PUT', body: JSON.stringify({ order }) },
      prev => ({ ...prev, projects: prev.projects.map(x => ({ ...x, order: order.indexOf(x.slug) })) }),
    )
  }

  const saveAway = (ranges: AwayRange[]) =>
    mutateRegistry(
      'away',
      { method: 'PUT', body: JSON.stringify({ ranges }) },
      (prev: Registry) => ({ ...prev, away: ranges }),
    )

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const cleanSlug = slug.trim().toLowerCase()
    if (!/^[a-z][a-z0-9-]{0,23}$/.test(cleanSlug)) {
      setFormError('slug: lowercase letters, digits, dashes, starts with a letter')
      return
    }
    const cleanPrefix = (prefix || defaultPrefix(cleanSlug)).toUpperCase()
    if (!/^[A-Z][A-Z0-9]{0,7}$/.test(cleanPrefix)) {
      setFormError('prefix: 1-8 uppercase letters/digits')
      return
    }
    const result = await mutateRegistry(
      'projects',
      { method: 'POST', body: JSON.stringify({ slug: cleanSlug, title: title.trim() || cleanSlug, prefix: cleanPrefix }) },
    )
    if (result) {
      setSlug('')
      setTitle('')
      setPrefix('')
      setPrefixTouched(false)
      slugRef.current?.focus()
    } else {
      setFormError('could not create — slug or prefix already taken?')
    }
  }

  return (
    <main id="boards-page">
      <HeaderNav
        title="boards"
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
          <div className="section-title"><span>boards</span><span>{projects.length}</span></div>
          <ul id="boards-list" className="item-list">
            <li className="board-row system">
              <a href="/ub/board/calendar/" className="board-title">calendar</a>
              <span className="board-prefix">—</span>
              <span className="board-count">built-in</span>
            </li>
            {projects.map((p, i) => {
              const cards = boardCards(data.cards, p.slug)
              return (
                <li key={p.slug} className={`board-row status-${p.status}`}>
                  <a href={`/ub/board/${p.slug}/`} className="board-title">{p.title}</a>
                  <span className="board-prefix">{p.prefix}</span>
                  <span className="board-count">{openCount(cards)} open</span>
                  <select
                    value={p.status}
                    aria-label={`Status of ${p.title}`}
                    onChange={e => patchProject(p, { status: e.target.value as Project['status'] })}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="archived">archived</option>
                  </select>
                  <span className="board-move">
                    <button aria-label="Move up" disabled={i === 0} onClick={() => move(p, -1)}>↑</button>
                    <button aria-label="Move down" disabled={i === projects.length - 1} onClick={() => move(p, 1)}>↓</button>
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="section-title"><span>new board</span></div>
          <form id="create-form" onSubmit={submitCreate}>
            <input
              ref={slugRef}
              placeholder="slug"
              value={slug}
              maxLength={24}
              onChange={e => {
                setSlug(e.target.value)
                if (!prefixTouched) setPrefix(defaultPrefix(e.target.value.trim().toLowerCase()))
              }}
            />
            <input placeholder="title" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} />
            <input
              placeholder="prefix"
              value={prefix}
              maxLength={8}
              className="prefix-input"
              onChange={e => { setPrefix(e.target.value.toUpperCase()); setPrefixTouched(true) }}
            />
            <button type="submit">create</button>
          </form>
          {formError && <p className="form-error">{formError}</p>}

          <div className="section-title"><span>away</span><span>{data.registry.away.length ? `${data.registry.away.length} range(s)` : 'none'}</span></div>
          <ul id="away-list" className="item-list">
            {data.registry.away.map(r => (
              <li key={`${r.start}|${r.end}`} className={r.end < today ? 'past' : undefined}>
                <span className="todo-text">{r.start} → {r.end}</span>
                <button
                  className="todo-delete"
                  aria-label="Remove away range"
                  onClick={() => saveAway(data.registry.away.filter(x => x !== r))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form
            id="away-form"
            onSubmit={e => {
              e.preventDefault()
              if (!awayStart || !awayEnd || awayEnd < awayStart) return
              saveAway([...data.registry.away, { start: awayStart, end: awayEnd }])
              setAwayStart('')
              setAwayEnd('')
            }}
          >
            <input type="date" value={awayStart} onChange={e => setAwayStart(e.target.value)} aria-label="Away from" />
            <input type="date" value={awayEnd} onChange={e => setAwayEnd(e.target.value)} aria-label="Away until" />
            <button type="submit">add range</button>
          </form>
          <p className="empty-note">routines that don't opt in stay quiet on away days; no misses are recorded.</p>

          <p id="sync-status" className={status.error ? 'error' : undefined}>{status.text}</p>
        </section>
      )}
    </main>
  )
}
