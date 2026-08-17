import { useRef, useState } from 'react'

export interface DragPreview {
  id: string
  cellKey: string | null
  ids: string[]
}

export interface DropResult {
  id: string
  cellKey: string
  ids: string[]
}

function cellUnder(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y)
  return el ? (el.closest('[data-cell]') as HTMLElement | null) : null
}

function orderWithin(cell: HTMLElement, id: string, y: number): string[] {
  const items = [...cell.querySelectorAll<HTMLElement>('[data-id]')].filter(el => el.dataset.id && el.dataset.id !== id)
  const after = items.find(el => {
    const r = el.getBoundingClientRect()
    return y < r.top + r.height / 2
  })
  const ids = items.map(el => el.dataset.id!)
  const idx = after ? ids.indexOf(after.dataset.id!) : ids.length
  return [...ids.slice(0, idx), id, ...ids.slice(idx)]
}

export function useCardDrag(onDrop: (result: DropResult) => void) {
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const previewRef = useRef<DragPreview | null>(null)

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    const initial: DragPreview = { id, cellKey: null, ids: [] }
    previewRef.current = initial
    setPreview(initial)

    const move = (ev: PointerEvent) => {
      ev.preventDefault()
      const cell = cellUnder(ev.clientX, ev.clientY)
      const current = previewRef.current
      if (!current) return
      const next: DragPreview = cell
        ? { id, cellKey: cell.dataset.cell || null, ids: orderWithin(cell, id, ev.clientY) }
        : { id, cellKey: null, ids: [] }
      previewRef.current = next
      setPreview(next)
    }

    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      const current = previewRef.current
      previewRef.current = null
      setPreview(null)
      if (current && current.cellKey) onDrop({ id: current.id, cellKey: current.cellKey, ids: current.ids })
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  return {
    draggingId: preview?.id ?? null,
    hoverCell: preview?.cellKey ?? null,
    previewIds: preview && preview.cellKey ? preview.ids : null,
    startDrag,
  }
}
