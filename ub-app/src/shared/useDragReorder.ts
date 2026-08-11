import { useRef, useState } from 'react'

interface DragState {
  id: string
  order: string[]
}

export function useDragReorder(commit: (order: string[]) => void) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const stateRef = useRef<DragState | null>(null)
  const containerRef = useRef<HTMLUListElement | null>(null)

  const startDrag = (id: string, ids: string[]) => (e: React.PointerEvent) => {
    e.preventDefault()
    const initial = { id, order: ids }
    stateRef.current = initial
    setDragState(initial)

    const move = (ev: PointerEvent) => {
      ev.preventDefault()
      const container = containerRef.current
      const current = stateRef.current
      if (!container || !current) return
      const others = [...container.children].filter(
        el => (el as HTMLElement).dataset.id && (el as HTMLElement).dataset.id !== current.id,
      ) as HTMLElement[]
      const after = others.find(el => {
        const r = el.getBoundingClientRect()
        return ev.clientY < r.top + r.height / 2
      })
      const without = current.order.filter(x => x !== current.id)
      const idx = after ? without.indexOf(after.dataset.id!) : without.length
      const next = {
        id: current.id,
        order: [...without.slice(0, idx), current.id, ...without.slice(idx)],
      }
      stateRef.current = next
      setDragState(next)
    }

    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      const current = stateRef.current
      stateRef.current = null
      setDragState(null)
      if (current) commit(current.order)
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  return {
    containerRef,
    draggingId: dragState?.id ?? null,
    dragOrder: dragState?.order ?? null,
    startDrag,
  }
}
