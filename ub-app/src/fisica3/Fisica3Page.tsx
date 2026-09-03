import { useCallback, useEffect, useState } from 'react'
import { apiGet, getToken, redirectToLogin, UnauthorizedError } from '../shared/api'
import { HeaderNav } from '../shared/HeaderNav'
import type { Fisica3Snapshot } from '../shared/types'
import { Chapter } from './Chapter'
import { courseTotals, formatAsOf, pctOf, redoText, stupidText } from './logic'

export function Fisica3Page() {
  const [snap, setSnap] = useState<Fisica3Snapshot | null>(null)
  const [status, setStatus] = useState('')
  const [loadedAt, setLoadedAt] = useState(0)

  const load = useCallback(async () => {
    if (!getToken()) {
      redirectToLogin()
      return
    }
    try {
      const data = await apiGet<{ fisica3: Fisica3Snapshot | null }>('fisica3')
      if (data.fisica3) {
        setSnap(data.fisica3)
        setStatus('')
      } else {
        setStatus('no snapshot yet — log an exercise to Vapula or wait for the aiur push')
      }
      setLoadedAt(Date.now())
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        redirectToLogin()
        return
      }
      setStatus('failed to load física 3 snapshot')
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    const id = setInterval(load, 60 * 1000)
    return () => {
      window.removeEventListener('focus', load)
      clearInterval(id)
    }
  }, [load])

  const totals = snap ? courseTotals(snap) : null
  const pct = totals ? pctOf(totals.solved, totals.total) : null

  useEffect(() => {
    document.title = pct == null ? 'ub física 3' : `ub física 3 · ${pct}%`
  }, [pct])

  const asOf = snap ? formatAsOf(snap.updated, loadedAt) : null
  const nextChapter = snap && snap.next_up != null
    ? snap.chapters.find(c => c.ch === snap.next_up)
    : null

  return (
    <main>
      <HeaderNav title="física 3" current="física 3" showLogout={false} onLogout={() => {}} />

      <div id="topbar">
        <span id="total">
          {totals && <><strong>{totals.solved}</strong> / {totals.total} solved{totals.wrong > 0 && <span className="redo">{redoText(totals.wrong)}</span>}{totals.stupid > 0 && <span className="stupid-count">{stupidText(totals.stupid)}</span>}</>}
        </span>
        {pct != null && <span id="pct">{pct}%</span>}
        <span id="as-of" className={asOf?.stale ? 'stale' : undefined}>{asOf?.text ?? ''}</span>
      </div>
      {snap && (
        <div id="next-up">
          {nextChapter
            ? <>next up: ch {nextChapter.ch} — {nextChapter.title}{nextChapter.deadline && <span className="due"> · due {nextChapter.deadline}</span>}</>
            : 'every item in the book is solved'}
        </div>
      )}
      {snap && !snap.has_dates && (
        <p id="no-dates">no aula dates yet — send "aula &lt;n&gt; &lt;date&gt;" lines to Vapula to enable pace tracking</p>
      )}
      <p id="status">{status}</p>

      <div id="chapters">
        {snap?.chapters.map(ch => <Chapter key={ch.ch} ch={ch} />)}
      </div>

      {snap && (
        <div id="legend">
          <span><span className="cell solved" style={{ width: 22 }}>7</span> solved</span>
          <span><span className="cell solved wrong" style={{ width: 22 }}>7</span> wrong — redo</span>
          <span><span className="cell" style={{ width: 22 }}>7</span> missing</span>
          <span><span className="cell stupid" style={{ width: 22 }}>7</span> stupid — skipped, not counted</span>
          <span>MC = múltipla escolha · Q = questões · P = problemas (gap = adicionais)</span>
          <span>log via Vapula on Telegram</span>
        </div>
      )}
    </main>
  )
}
