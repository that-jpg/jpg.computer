import { useCallback, useRef, useState } from 'react'
import { apiFetch, UnauthorizedError } from './api'
import type { AllPayload, Card, Registry } from './board'
import type { CalendarDone, WeekGoals } from './types'

export interface SyncStatus {
  text: string
  error: boolean
}

export function useBoard(onUnauthorized: () => void) {
  const [data, setData] = useState<AllPayload | null>(null)
  const [status, setStatus] = useState<SyncStatus>({ text: '', error: false })
  const seqRef = useRef(0)
  const lastMutatedAtRef = useRef(0)

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const payload = await apiFetch<AllPayload>('all')
      setData(payload)
      setStatus({ text: '', error: false })
      return true
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        onUnauthorized()
        return false
      }
      setStatus({ text: 'failed to load the board', error: true })
      return true
    }
  }, [onUnauthorized])

  const applyCards = useCallback((cards: Card[]) => {
    setData(prev => (prev ? { ...prev, cards } : prev))
  }, [])

  const applyRegistry = useCallback((registry: Registry) => {
    setData(prev => (prev ? { ...prev, registry } : prev))
  }, [])

  const setWeekGoals = useCallback((weekGoals: WeekGoals | null) => {
    setData(prev => (prev ? { ...prev, weekGoals } : prev))
  }, [])

  const setCalendarDone = useCallback((update: (prev: CalendarDone) => CalendarDone) => {
    setData(prev => (prev ? { ...prev, calendarDone: update(prev.calendarDone) } : prev))
  }, [])

  const run = useCallback(
    async <T,>(
      query: string,
      init: RequestInit,
      optimistic: (() => void) | undefined,
      apply: (payload: T) => void,
    ) => {
      if (optimistic) optimistic()
      const seq = ++seqRef.current
      lastMutatedAtRef.current = Date.now()
      setStatus({ text: 'saving...', error: false })
      try {
        const payload = await apiFetch<T>(query, init)
        lastMutatedAtRef.current = Date.now()
        if (seq === seqRef.current) {
          apply(payload)
          setStatus({ text: 'saved', error: false })
        }
        return payload
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          onUnauthorized()
          return null
        }
        setStatus({ text: 'sync failed - refresh to see the saved board', error: true })
        return null
      }
    },
    [onUnauthorized],
  )

  const mutateCards = useCallback(
    (query: string, init: RequestInit, optimistic?: (prev: Card[]) => Card[]) =>
      run<{ cards: Card[] }>(
        query,
        init,
        optimistic ? () => setData(prev => (prev ? { ...prev, cards: optimistic(prev.cards) } : prev)) : undefined,
        payload => applyCards(payload.cards),
      ),
    [run, applyCards],
  )

  const mutateRegistry = useCallback(
    (query: string, init: RequestInit, optimistic?: (prev: Registry) => Registry) =>
      run<{ registry: Registry }>(
        query,
        init,
        optimistic ? () => setData(prev => (prev ? { ...prev, registry: optimistic(prev.registry) } : prev)) : undefined,
        payload => applyRegistry(payload.registry),
      ),
    [run, applyRegistry],
  )

  const mutateWeek = useCallback(
    (query: string, init: RequestInit, optimistic?: (prev: WeekGoals | null) => WeekGoals | null) =>
      run<{ weekGoals: WeekGoals | null }>(
        query,
        init,
        optimistic ? () => setData(prev => (prev ? { ...prev, weekGoals: optimistic(prev.weekGoals) } : prev)) : undefined,
        payload => setWeekGoals(payload.weekGoals),
      ),
    [run, setWeekGoals],
  )

  const recentlyMutated = useCallback(() => Date.now() - lastMutatedAtRef.current < 5000, [])

  const markMutated = useCallback(() => {
    lastMutatedAtRef.current = Date.now()
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setStatus({ text: '', error: false })
  }, [])

  return {
    data,
    status,
    setStatus,
    load,
    mutateCards,
    mutateRegistry,
    mutateWeek,
    setCalendarDone,
    recentlyMutated,
    markMutated,
    reset,
  }
}
