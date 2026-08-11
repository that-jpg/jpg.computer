import { useEffect, useRef, useState } from 'react'
import { apiLogin } from './api'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState('')
  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    userRef.current?.focus()
  }, [])

  return (
    <form
      id="login-view"
      onSubmit={async e => {
        e.preventDefault()
        setError('')
        try {
          const result = await apiLogin(userRef.current!.value, passRef.current!.value)
          if (!result.ok) {
            setError(result.error)
            return
          }
          passRef.current!.value = ''
          onSuccess()
        } catch {
          setError('Network error')
        }
      }}
    >
      <input ref={userRef} id="login-user" placeholder="user" autoComplete="username" required />
      <input ref={passRef} id="login-pass" type="password" placeholder="password" autoComplete="current-password" required />
      <p id="login-error">{error}</p>
      <button type="submit">Enter</button>
    </form>
  )
}
