import { useEffect, useState } from 'react'
import type { Fisica3Chapter } from '../shared/types'
import type { Attempt } from '../fight-against-evil/logic'
import { shortDate } from '../shared/format'
import { badgeText, blockGroups, blockTallies, chapterTotal, redoText, stupidSet, stupidText, wrongSet } from './logic'

const BLOCK_LABELS = { MC: 'múltipla escolha', Q: 'questões', P: 'problemas' } as const

/** docs: item number → every reviewed submission; one makes the cell a link, several open a list. */
export function Chapter({ ch, docs }: { ch: Fisica3Chapter; docs?: ReadonlyMap<number, Attempt[]> }) {
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    if (open == null) return
    const close = () => setOpen(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])
  const solved = new Set(ch.solved)
  const wrong = wrongSet(ch)
  const stupid = stupidSet(ch)
  const total = chapterTotal(ch)
  return (
    <section className="chapter">
      <div className="chapter-head">
        <h2>{ch.ch} <span>· {ch.title}</span></h2>
        <span className="tally">{solved.size}/{total}</span>
        {wrong.size > 0 && <span className="redo">{redoText(wrong.size).trim()}</span>}
        {stupid.size > 0 && <span className="stupid-count">{stupidText(stupid.size).trim()}</span>}
        <span className="ch-pct">{total ? (100 * solved.size / total).toFixed(1) : '0.0'}%</span>
        <span className="blocks">{blockTallies(ch)}</span>
        <span className={`badge ${ch.status}`}>{badgeText(ch)}</span>
      </div>
      <div className="meter">
        <div style={{ width: `${total ? (100 * solved.size) / total : 0}%` }} />
      </div>
      {blockGroups(ch).map(block =>
        block.to < block.from ? null : (
          <div className="block-group" key={block.label}>
            <div className="block-label">{BLOCK_LABELS[block.label]}</div>
            <div className="grid">
              {Array.from({ length: block.to - block.from + 1 }, (_, i) => block.from + i).map(n => {
                const attempts = docs?.get(n) ?? []
                const className = `cell${solved.has(n) ? ' solved' : ''}${wrong.has(n) ? ' wrong' : ''}${stupid.has(n) ? ' stupid' : ''}${attempts.length ? ' doc' : ''}${block.label === 'P' && n === ch.ad_start ? ' ad-first' : ''}`
                const state = stupid.has(n) ? 'stupid — skipped' : wrong.has(n) ? 'wrong' : solved.has(n) ? 'solved' : 'missing'
                if (attempts.length === 1) {
                  const only = attempts[0]
                  const docTitle = only.verdict === 'wrong' ? 'wrong attempt, to redo' : 'solution reviewed as correct'
                  return (
                    <a key={n} className={className} href={only.href} target="_blank" rel="noopener" title={`${ch.ch}.${n} — ${docTitle}`}>
                      {n}
                    </a>
                  )
                }
                return attempts.length > 1 ? (
                  <span key={n} className="cell-menu">
                    <button
                      type="button"
                      className={className}
                      aria-expanded={open === n}
                      title={`${ch.ch}.${n} — ${attempts.length} submissions, latest ${attempts[attempts.length - 1].verdict}`}
                      onClick={e => {
                        e.stopPropagation()
                        setOpen(open === n ? null : n)
                      }}
                    >
                      {n}
                    </button>
                    {open === n && (
                      <span className="attempts" onClick={e => e.stopPropagation()}>
                        {attempts.map(a => (
                          <a key={a.attempt} className={`attempt ${a.verdict}`} href={a.href} target="_blank" rel="noopener">
                            #{a.attempt} {a.verdict}{a.reviewed && <span className="when"> · {shortDate(new Date(a.reviewed))}</span>}
                          </a>
                        ))}
                      </span>
                    )}
                  </span>
                ) : (
                  <span key={n} className={className} title={`${ch.ch}.${n} — ${state}`}>
                    {n}
                  </span>
                )
              })}
            </div>
          </div>
        ),
      )}
    </section>
  )
}
