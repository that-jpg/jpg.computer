import { useCallback, useRef, useState } from 'react'
import { apiFetch, UnauthorizedError } from './api'
import type { Todo } from './types'

export interface SyncStatus {
  text: string
  error: boolean
}

export function useTodos(onUnauthorized: () => void) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [status, setStatus] = useState<SyncStatus>({ text: '', error: false })
  const seqRef = useRef(0)
  const lastMutatedAtRef = useRef(0)

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const data = await apiFetch<{ todos: Todo[] }>('todos')
      setTodos(data.todos)
      setStatus({ text: '', error: false })
      return true
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        onUnauthorized()
        return false
      }
      setStatus({ text: 'failed to load todos', error: true })
      return true
    }
  }, [onUnauthorized])

  const mutate = useCallback(
    async (query: string, init: RequestInit, optimistic?: (prev: Todo[]) => Todo[]) => {
      if (optimistic) setTodos(optimistic)
      const seq = ++seqRef.current
      lastMutatedAtRef.current = Date.now()
      setStatus({ text: 'saving...', error: false })
      try {
        const data = await apiFetch<{ todos: Todo[] }>(query, init)
        lastMutatedAtRef.current = Date.now()
        if (seq === seqRef.current) {
          setTodos(data.todos)
          setStatus({ text: 'saved', error: false })
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          onUnauthorized()
          return
        }
        setStatus({ text: 'sync failed - refresh to see the saved list', error: true })
      }
    },
    [onUnauthorized],
  )

  const recentlyMutated = useCallback(() => Date.now() - lastMutatedAtRef.current < 5000, [])

  const markMutated = useCallback(() => {
    lastMutatedAtRef.current = Date.now()
  }, [])

  const reset = useCallback(() => {
    setTodos([])
    setStatus({ text: '', error: false })
  }, [])

  return { todos, status, setStatus, load, mutate, recentlyMutated, markMutated, reset }
}
