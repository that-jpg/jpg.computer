import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, clearToken, getToken, UnauthorizedError } from '../shared/api'
import { HeaderNav } from '../shared/HeaderNav'
import { LoginForm } from '../shared/LoginForm'
import type { FinanceSnapshot, FitnessSnapshot, FrenchSnapshot, GoalsSnapshot, VenturesSnapshot } from '../shared/types'
import { FinanceDomain } from './FinanceDomain'
import { FitnessDomain } from './FitnessDomain'
import { FrenchDomain } from './FrenchDomain'
import { MonthSection } from './MonthSection'
import { VenturesDomain } from './VenturesDomain'

export function MetricsPage() {
  const [view, setView] = useState<'boot' | 'login' | 'app'>(getToken() ? 'boot' : 'login')
  const [goals, setGoals] = useState<GoalsSnapshot | null | undefined>(undefined)
  const [fitness, setFitness] = useState<FitnessSnapshot | null | undefined>(undefined)
  const [french, setFrench] = useState<FrenchSnapshot | null | undefined>(undefined)
  const [finance, setFinance] = useState<FinanceSnapshot | null | undefined>(undefined)
  const [ventures, setVentures] = useState<VenturesSnapshot | null | undefined>(undefined)

  const showLogin = useCallback(() => {
    clearToken()
    setView('login')
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const data = await apiFetch<{ fitness: FitnessSnapshot | null }>('fitness')
      setView('app')
      setFitness(data.fitness)
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        showLogin()
        return
      }
      setView('app')
      setFitness(null)
    }
    try {
      setFrench((await apiFetch<{ french: FrenchSnapshot | null }>('french')).french)
    } catch {
      setFrench(null)
    }
    try {
      setFinance((await apiFetch<{ finance: FinanceSnapshot | null }>('finance')).finance)
    } catch {
      setFinance(null)
    }
    try {
      setVentures((await apiFetch<{ ventures: VenturesSnapshot | null }>('ventures')).ventures)
    } catch {
      setVentures(null)
    }
    try {
      setGoals((await apiFetch<{ goals: GoalsSnapshot | null }>('goals')).goals)
    } catch {
      setGoals(null)
    }
  }, [showLogin])

  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    if (getToken()) loadAll()
    const refresh = () => {
      if (document.hidden || !getToken() || viewRef.current !== 'app') return
      loadAll()
    }
    document.addEventListener('visibilitychange', refresh)
    const id = setInterval(refresh, 300000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [loadAll])

  return (
    <main>
      <HeaderNav
        title="metrics"
        current="metrics"
        showLogout={view === 'app'}
        onLogout={async () => {
          try {
            await apiFetch('logout', { method: 'POST' })
          } catch {}
          showLogin()
        }}
      />

      {view === 'login' && <LoginForm onSuccess={loadAll} />}

      {view === 'app' && (
        <section id="app-view">
          <MonthSection goals={goals} />
          <FitnessDomain f={fitness} />
          <FrenchDomain f={french} />
          <FinanceDomain f={finance} />
          <VenturesDomain v={ventures} />
        </section>
      )}
    </main>
  )
}
