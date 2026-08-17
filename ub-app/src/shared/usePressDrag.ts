import { useRef } from 'react'

const DRAG_THRESHOLD_PX = 6

export function usePressDrag() {
  const armedRef = useRef(false)

  const onPress = (start: ((e: React.PointerEvent) => void) | undefined, onClick: () => void) =>
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, select, textarea')) return
      const x0 = e.clientX
      const y0 = e.clientY
      let dragging = false
      armedRef.current = true
      const move = (ev: PointerEvent) => {
        if (dragging || !start) return
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < DRAG_THRESHOLD_PX) return
        dragging = true
        cleanup()
        start({ preventDefault() {} } as React.PointerEvent)
      }
      const up = () => {
        cleanup()
        if (!dragging && armedRef.current) onClick()
        armedRef.current = false
      }
      const cleanup = () => {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        document.removeEventListener('pointercancel', up)
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
      document.addEventListener('pointercancel', up)
    }

  return { onPress }
}
