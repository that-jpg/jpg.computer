const API = '/api/ub'
const TOKEN_KEY = 'ub-token'

export class UnauthorizedError extends Error {}

export class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`http ${status}`)
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiFetch<T>(action: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}?action=${action}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
      Authorization: `Bearer ${getToken()}`,
    },
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new HttpError(res.status)
  return res.json()
}

export async function apiLogin(username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${API}?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error || 'Login failed' }
  setToken(data.token)
  return { ok: true }
}

export async function apiGet<T>(action: string): Promise<T> {
  return apiFetch<T>(action)
}

export function redirectToLogin(): void {
  location.href = '/ub/'
}
