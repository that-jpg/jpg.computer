import { useCallback, useEffect, useState } from 'react'
import { Chapter } from '../fisica3/Chapter'
import { courseTotals, formatAsOf, pctOf, redoText, stupidText } from '../fisica3/logic'
import { shortDate } from '../shared/format'
import type { Fisica3Snapshot } from '../shared/types'
import { docCount, docsByChapter, latestReview, SOLUTIONS_BASE, submissionCount, type SolutionsManifest } from './logic'

const SNAPSHOT_URL = '/api/ub?action=fisica3-public'
const MANIFEST_URL = `${SOLUTIONS_BASE}manifest.json`

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`http ${res.status}`)
  return res.json()
}

export function FightPage() {
  const [snap, setSnap] = useState<Fisica3Snapshot | null>(null)
  const [manifest, setManifest] = useState<SolutionsManifest | null>(null)
  const [status, setStatus] = useState('')
  const [loadedAt, setLoadedAt] = useState(0)

  const load = useCallback(async () => {
    const [snapshot, docs] = await Promise.allSettled([
      fetchJson<{ fisica3: Fisica3Snapshot | null }>(SNAPSHOT_URL),
      fetchJson<SolutionsManifest>(MANIFEST_URL),
    ])
    if (snapshot.status === 'fulfilled') {
      setSnap(snapshot.value.fisica3)
      setStatus(snapshot.value.fisica3 ? '' : 'no snapshot yet')
      setLoadedAt(Date.now())
    } else {
      setStatus('failed to load the física 3 snapshot')
    }
    setManifest(docs.status === 'fulfilled' ? docs.value : null)
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', load)
      clearInterval(id)
    }
  }, [load])

  const totals = snap ? courseTotals(snap) : null
  const pct = totals ? pctOf(totals.solved, totals.total) : null

  useEffect(() => {
    document.title = pct == null ? 'fight against evil' : `fight against evil · ${pct}%`
  }, [pct])

  const asOf = snap ? formatAsOf(snap.updated, loadedAt) : null
  const nextChapter = snap && snap.next_up != null
    ? snap.chapters.find(c => c.ch === snap.next_up)
    : null
  const docs = docsByChapter(manifest)
  const nDocs = docCount(manifest)
  const nSubmissions = submissionCount(manifest)
  const newest = latestReview(manifest)

  return (
    <main>
      <header>
        <h1>fight against evil <em>física 3</em></h1>
        <nav id="header-nav">
          <a href="/">jpg.computer</a>
        </nav>
      </header>

      <p id="intro">
        Every exercise in <em>{snap?.book ?? 'Bauer, Westfall, Dias — Física para Universitários: Eletricidade e Magnetismo'}</em>,
        solved one by one. Each solution is photographed and graded;
        cells with a white underline link to the solutions that were graded <strong>correct</strong>.
      </p>

      <div id="topbar">
        <span id="total">
          {totals && <><strong>{totals.solved}</strong> / {totals.total} solved{totals.wrong > 0 && <span className="redo">{redoText(totals.wrong)}</span>}{totals.stupid > 0 && <span className="stupid-count">{stupidText(totals.stupid)}</span>}</>}
        </span>
        {pct != null && <span id="pct">{pct}%</span>}
        <span id="docs-count">
          {nDocs > 0 && <a href={`${SOLUTIONS_BASE}manifest.json`}>{nDocs} reviewed solution{nDocs === 1 ? '' : 's'}{nSubmissions > nDocs && ` · ${nSubmissions} submissions`}</a>}
          {nDocs > 0 && newest && <span className="muted"> · newest {shortDate(new Date(newest))}</span>}
        </span>
        <span id="as-of" className={asOf?.stale ? 'stale' : undefined}>{asOf?.text ?? ''}</span>
      </div>
      {snap && (
        <div id="next-up">
          {nextChapter
            ? <>next up: ch {nextChapter.ch} — {nextChapter.title}{nextChapter.deadline && <span className="due"> · due {nextChapter.deadline}</span>}</>
            : 'every item in the book is solved'}
        </div>
      )}
      <p id="status">{status}</p>

      <div id="chapters">
        {snap?.chapters.map(ch => <Chapter key={ch.ch} ch={ch} docs={docs.get(ch.ch)} />)}
      </div>

      {snap && (
        <div id="legend">
          <span><span className="cell solved" style={{ width: 22 }}>7</span> solved</span>
          <span><span className="cell solved doc" style={{ width: 22 }}>7</span> solved · reviewed solution (click)</span>
          <span><span className="cell solved wrong doc" style={{ width: 22 }}>7</span> wrong — redo (click for the attempts)</span>
          <span><span className="cell" style={{ width: 22 }}>7</span> missing</span>
          <span><span className="cell stupid" style={{ width: 22 }}>7</span> stupid — skipped, not counted</span>
          <span>MC = múltipla escolha · Q = questões · P = problemas (gap = adicionais)</span>
        </div>
      )}
    </main>
  )
}
