import type { Fisica3Chapter } from '../shared/types'
import { badgeText, blockGroups, blockTallies, redoText, wrongSet } from './logic'

const BLOCK_LABELS = { MC: 'múltipla escolha', Q: 'questões', P: 'problemas' } as const

/** docs: item number → href of the solution reviewed as correct (cells become links). */
export function Chapter({ ch, docs }: { ch: Fisica3Chapter; docs?: ReadonlyMap<number, string> }) {
  const solved = new Set(ch.solved)
  const wrong = wrongSet(ch)
  return (
    <section className="chapter">
      <div className="chapter-head">
        <h2>{ch.ch} <span>· {ch.title}</span></h2>
        <span className="tally">{solved.size}/{ch.max}</span>
        {wrong.size > 0 && <span className="redo">{redoText(wrong.size).trim()}</span>}
        <span className="ch-pct">{(100 * solved.size / ch.max).toFixed(1)}%</span>
        <span className="blocks">{blockTallies(ch)}</span>
        <span className={`badge ${ch.status}`}>{badgeText(ch)}</span>
      </div>
      <div className="meter">
        <div style={{ width: `${(100 * solved.size) / ch.max}%` }} />
      </div>
      {blockGroups(ch).map(block =>
        block.to < block.from ? null : (
          <div className="block-group" key={block.label}>
            <div className="block-label">{BLOCK_LABELS[block.label]}</div>
            <div className="grid">
              {Array.from({ length: block.to - block.from + 1 }, (_, i) => block.from + i).map(n => {
                const href = docs?.get(n)
                const className = `cell${solved.has(n) ? ' solved' : ''}${wrong.has(n) ? ' wrong' : ''}${href ? ' doc' : ''}${block.label === 'P' && n === ch.ad_start ? ' ad-first' : ''}`
                const state = wrong.has(n) ? 'wrong' : solved.has(n) ? 'solved' : 'missing'
                return href ? (
                  <a key={n} className={className} href={href} target="_blank" rel="noopener" title={`${ch.ch}.${n} — solution reviewed as correct`}>
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
