import type { Fisica3Chapter } from '../shared/types'
import type { SolutionLink } from '../fight-against-evil/logic'
import { badgeText, blockGroups, blockTallies, chapterTotal, redoText, stupidSet, stupidText, wrongSet } from './logic'

const BLOCK_LABELS = { MC: 'múltipla escolha', Q: 'questões', P: 'problemas' } as const

/** docs: item number → reviewed document (cells become links): the correct solution, or the latest wrong attempt. */
export function Chapter({ ch, docs }: { ch: Fisica3Chapter; docs?: ReadonlyMap<number, SolutionLink> }) {
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
                const doc = docs?.get(n)
                const className = `cell${solved.has(n) ? ' solved' : ''}${wrong.has(n) ? ' wrong' : ''}${stupid.has(n) ? ' stupid' : ''}${doc ? ' doc' : ''}${block.label === 'P' && n === ch.ad_start ? ' ad-first' : ''}`
                const state = stupid.has(n) ? 'stupid — skipped' : wrong.has(n) ? 'wrong' : solved.has(n) ? 'solved' : 'missing'
                const docTitle = doc?.verdict === 'wrong' ? 'wrong attempt, to redo' : 'solution reviewed as correct'
                return doc ? (
                  <a key={n} className={className} href={doc.href} target="_blank" rel="noopener" title={`${ch.ch}.${n} — ${docTitle}`}>
                    {n}
                  </a>
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
