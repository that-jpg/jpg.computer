import { useState } from 'react'
import { ruleLabel, SIGNALS, type Project, type RecurrenceRule, type Registry, type Template } from '../shared/board'

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type RegistryMutate = (
  query: string,
  init: RequestInit,
  optimistic?: (prev: Registry) => Registry,
) => Promise<unknown>

interface Draft {
  title: string
  kind: 'routine' | 'auto-routine'
  ruleType: RecurrenceRule['type']
  days: number[]
  dom: number
  whileAway: boolean
  signal: string
  mode: 'always' | 'on-signal'
}

function emptyDraft(): Draft {
  return { title: '', kind: 'routine', ruleType: 'daily', days: [1, 2, 3, 4, 5], dom: 1, whileAway: false, signal: 'food', mode: 'always' }
}

function draftOf(t: Template): Draft {
  return {
    title: t.title,
    kind: t.kind,
    ruleType: t.rule.type,
    days: t.rule.type === 'weekdays' ? t.rule.days : [1, 2, 3, 4, 5],
    dom: t.rule.type === 'monthly' ? t.rule.dom : 1,
    whileAway: t.whileAway,
    signal: t.signal || 'food',
    mode: t.mode || 'always',
  }
}

function ruleOf(d: Draft): RecurrenceRule {
  if (d.ruleType === 'weekdays') return { type: 'weekdays', days: [...d.days].sort() }
  if (d.ruleType === 'monthly') return { type: 'monthly', dom: Math.max(1, Math.min(31, d.dom)) }
  return { type: 'daily' }
}

function bodyOf(d: Draft) {
  return {
    title: d.title.replace(/\s+/g, ' ').trim(),
    kind: d.kind,
    rule: ruleOf(d),
    whileAway: d.whileAway,
    signal: d.kind === 'auto-routine' ? d.signal : null,
    mode: d.kind === 'auto-routine' ? d.mode : null,
  }
}

function DraftForm({ draft, setDraft, onSubmit, onCancel, submitLabel }: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
}) {
  return (
    <form
      className="template-form"
      onSubmit={e => {
        e.preventDefault()
        if (!draft.title.trim()) return
        onSubmit()
      }}
    >
      <input
        placeholder="routine title"
        value={draft.title}
        maxLength={200}
        onChange={e => setDraft({ ...draft, title: e.target.value })}
      />
      <div className="template-row">
        <select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as Draft['kind'] })}>
          <option value="routine">routine (tap)</option>
          <option value="auto-routine">auto-routine (from data)</option>
        </select>
        <select value={draft.ruleType} onChange={e => setDraft({ ...draft, ruleType: e.target.value as Draft['ruleType'] })}>
          <option value="daily">every day</option>
          <option value="weekdays">chosen weekdays</option>
          <option value="monthly">monthly on a date</option>
        </select>
        {draft.ruleType === 'weekdays' && (
          <span className="weekday-picks">
            {DAY_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                className={draft.days.includes(i) ? 'active' : undefined}
                onClick={() => setDraft({
                  ...draft,
                  days: draft.days.includes(i) ? draft.days.filter(d => d !== i) : [...draft.days, i],
                })}
              >
                {name}
              </button>
            ))}
          </span>
        )}
        {draft.ruleType === 'monthly' && (
          <input
            type="number"
            min={1}
            max={31}
            value={draft.dom}
            className="dom-input"
            onChange={e => setDraft({ ...draft, dom: Number(e.target.value) })}
          />
        )}
      </div>
      <div className="template-row">
        <label className="template-check">
          <input type="checkbox" checked={draft.whileAway} onChange={e => setDraft({ ...draft, whileAway: e.target.checked })} />
          spawns while away
        </label>
        {draft.kind === 'auto-routine' && (
          <>
            <select value={draft.signal} onChange={e => setDraft({ ...draft, signal: e.target.value })}>
              {SIGNALS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as Draft['mode'] })}>
              <option value="always">always spawn</option>
              <option value="on-signal">on signal only</option>
            </select>
          </>
        )}
        <span className="template-actions">
          <button type="submit">{submitLabel}</button>
          {onCancel && <button type="button" onClick={onCancel}>cancel</button>}
        </span>
      </div>
    </form>
  )
}

export function TemplatesEditor({ project, mutateRegistry }: { project: Project; mutateRegistry: RegistryMutate }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [adding, setAdding] = useState(false)

  const patchProject = (mutator: (p: Project) => Project) => (prev: Registry): Registry => ({
    ...prev,
    projects: prev.projects.map(p => (p.slug === project.slug ? mutator(p) : p)),
  })

  return (
    <div id="templates-editor">
      <div className="section-title">
        <span>routine templates</span>
        {!adding && (
          <button className="panel-mini" onClick={() => { setDraft(emptyDraft()); setAdding(true); setEditingId(null) }}>+ template</button>
        )}
      </div>
      {adding && (
        <DraftForm
          draft={draft}
          setDraft={setDraft}
          submitLabel="add"
          onCancel={() => setAdding(false)}
          onSubmit={() => {
            const body = bodyOf(draft)
            setAdding(false)
            mutateRegistry(
              'templates',
              { method: 'POST', body: JSON.stringify({ project: project.slug, ...body }) },
              patchProject(p => ({
                ...p,
                templates: [...p.templates, { id: `pending-${Date.now()}`, ...body } as Template],
              })),
            )
          }}
        />
      )}
      <ul className="template-list">
        {project.templates.map(t => (
          <li key={t.id} className={editingId === t.id ? 'editing' : undefined}>
            {editingId === t.id ? (
              <DraftForm
                draft={draft}
                setDraft={setDraft}
                submitLabel="save"
                onCancel={() => setEditingId(null)}
                onSubmit={() => {
                  const body = bodyOf(draft)
                  setEditingId(null)
                  mutateRegistry(
                    'templates',
                    { method: 'PATCH', body: JSON.stringify({ project: project.slug, id: t.id, ...body }) },
                    patchProject(p => ({ ...p, templates: p.templates.map(x => (x.id === t.id ? { ...x, ...body } as Template : x)) })),
                  )
                }}
              />
            ) : (
              <>
                <span className="card-glyph">{t.kind === 'auto-routine' ? '◇' : '↻'}</span>
                <span className="todo-text" onClick={() => { setDraft(draftOf(t)); setEditingId(t.id); setAdding(false) }}>{t.title}</span>
                <span className="template-meta">
                  {ruleLabel(t.rule)}
                  {t.whileAway ? ' · while away' : ''}
                  {t.kind === 'auto-routine' ? ` · ${t.signal} · ${t.mode === 'on-signal' ? 'on signal' : 'always'}` : ''}
                </span>
                <button
                  className="todo-delete"
                  aria-label="Retire template"
                  onClick={() => mutateRegistry(
                    `templates&project=${encodeURIComponent(project.slug)}&id=${encodeURIComponent(t.id)}`,
                    { method: 'DELETE' },
                    patchProject(p => ({ ...p, templates: p.templates.filter(x => x.id !== t.id) })),
                  )}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {project.templates.length === 0 && !adding && <p className="empty-note">no routines on this board</p>}
    </div>
  )
}
