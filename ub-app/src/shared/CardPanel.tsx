import { useEffect, useRef, useState } from 'react'
import { COLUMNS, projectsByOrder, ruleLabel, type Card, type ChecklistItem, type Column, type Registry } from './board'
import { COLUMN_LABELS } from './BoardGrid'

export interface CardPatch {
  text?: string
  description?: string
  checklist?: ChecklistItem[]
  date?: string | null
  expires?: boolean
  project?: string | null
  column?: Column
}

export interface CardPanelProps {
  card: Card
  registry: Registry
  today: string
  onPatch: (card: Card, patch: CardPatch) => void
  onDelete: (card: Card) => void
  onClose: () => void
}

function stamp(ms: number): string {
  const d = new Date(ms)
  return `${d.toLocaleDateString('en-CA')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function CardPanel({ card, registry, today, onPatch, onDelete, onClose }: CardPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newItem, setNewItem] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const task = card.kind === 'task'
  const readOnly = !task
  const project = registry.projects.find(p => p.slug === card.project) || null
  const template = project ? project.templates.find(t => t.id === card.template) || null : null

  useEffect(() => {
    setConfirmDelete(false)
    setNewItem('')
    if (titleRef.current) titleRef.current.value = card.text
    if (descRef.current) descRef.current.value = card.description
  }, [card.id, card.text, card.description])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const commitTitle = () => {
    const text = titleRef.current!.value.replace(/\s+/g, ' ').trim()
    if (!text || text === card.text) {
      titleRef.current!.value = card.text
      return
    }
    onPatch(card, { text })
  }

  const commitDescription = () => {
    const description = descRef.current!.value
    if (description === card.description) return
    onPatch(card, { description })
  }

  const setChecklist = (checklist: ChecklistItem[]) => onPatch(card, { checklist })

  return (
    <aside id="card-panel" className={readOnly ? 'read-only' : undefined} aria-label="Card details">
      <div className="panel-head">
        <span className="panel-kind">
          {card.key || (card.kind === 'task' ? 'inbox' : card.kind)}
          {project && <span className="panel-project"> · {project.title}</span>}
        </span>
        <button className="panel-close" aria-label="Close panel" onClick={onClose}>×</button>
      </div>

      {task ? (
        <input
          ref={titleRef}
          className="panel-title"
          defaultValue={card.text}
          maxLength={500}
          onBlur={commitTitle}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              titleRef.current!.blur()
            }
          }}
        />
      ) : (
        <p className="panel-title static">{card.text}</p>
      )}

      {template && (
        <p className="panel-template">
          from template <em>{template.title}</em> · {ruleLabel(template.rule)}
          {template.kind === 'auto-routine' && ` · ${template.mode === 'on-signal' ? 'on signal' : 'always'} · ${template.signal}`}
          {project && (
            <>
              {' · '}
              <a href={`/ub/board/${project.slug}/?templates=1`}>edit</a>
            </>
          )}
        </p>
      )}

      <div className="panel-row">
        <span className="panel-label">column</span>
        <div className="panel-columns">
          {COLUMNS.map(column => {
            const allowed = column !== 'backlog' || (task && card.project !== null)
            if (!allowed) return null
            return (
              <button
                key={column}
                className={column === card.column ? 'active' : undefined}
                disabled={card.kind === 'auto-routine' || column === card.column}
                onClick={() => onPatch(card, { column })}
              >
                {COLUMN_LABELS[column]}
              </button>
            )
          })}
        </div>
      </div>

      {task && (
        <div className="panel-row">
          <span className="panel-label">project</span>
          <select
            value={card.project || ''}
            onChange={e => onPatch(card, { project: e.target.value || null })}
          >
            <option value="">inbox</option>
            {projectsByOrder(registry).filter(p => p.status !== 'archived').map(p => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
        </div>
      )}

      {task && (
        <div className="panel-row">
          <span className="panel-label">date</span>
          <input
            type="date"
            value={card.date || ''}
            disabled={card.project === null}
            title={card.project === null ? 'pick a project first' : undefined}
            onChange={e => onPatch(card, { date: e.target.value || null })}
          />
          {card.date && (
            <button className="panel-mini" onClick={() => onPatch(card, { date: null })}>clear</button>
          )}
          {card.project !== null && card.date !== today && (
            <button className="panel-mini" onClick={() => onPatch(card, { date: today })}>today</button>
          )}
        </div>
      )}

      {task && card.date && (
        <div className="panel-row">
          <span className="panel-label">at day end</span>
          <div className="panel-columns">
            <button className={!card.expires ? 'active' : undefined} disabled={!card.expires} onClick={() => onPatch(card, { expires: false })}>carries</button>
            <button className={card.expires ? 'active' : undefined} disabled={card.expires} onClick={() => onPatch(card, { expires: true })}>expires</button>
          </div>
        </div>
      )}

      {task && (
        <textarea
          ref={descRef}
          className="panel-description"
          placeholder="description"
          defaultValue={card.description}
          rows={4}
          maxLength={5000}
          onBlur={commitDescription}
        />
      )}

      {task && (
        <div className="panel-checklist">
          <span className="panel-label">checklist</span>
          <ul>
            {card.checklist.map(item => (
              <li key={item.id} className={item.done ? 'done' : undefined}>
                <button
                  className="week-toggle"
                  aria-label={item.done ? 'Uncheck item' : 'Check item'}
                  onClick={() => setChecklist(card.checklist.map(c => (c.id === item.id ? { ...c, done: !c.done } : c)))}
                />
                <span className="todo-text">{item.text}</span>
                <button
                  className="todo-delete"
                  aria-label="Remove item"
                  onClick={() => setChecklist(card.checklist.filter(c => c.id !== item.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={e => {
              e.preventDefault()
              const text = newItem.replace(/\s+/g, ' ').trim()
              if (!text) return
              setNewItem('')
              setChecklist([...card.checklist, { id: `pending-${Date.now()}`, text, done: false }])
            }}
          >
            <input
              value={newItem}
              placeholder="add a step"
              maxLength={200}
              onChange={e => setNewItem(e.target.value)}
            />
          </form>
        </div>
      )}

      <p className="panel-stamps">
        created {stamp(card.created)}
        {card.doneOn && ` · done ${card.doneOn}${card.doneVia && card.doneVia !== 'tap' ? ` (${card.doneVia})` : ''}`}
      </p>

      {card.kind !== 'auto-routine' && (
        <div className="panel-actions">
          {confirmDelete ? (
            <>
              <button className="danger" onClick={() => onDelete(card)}>delete for good</button>
              <button onClick={() => setConfirmDelete(false)}>keep</button>
            </>
          ) : (
            <button className="panel-mini" onClick={() => setConfirmDelete(true)}>delete</button>
          )}
        </div>
      )}
    </aside>
  )
}
