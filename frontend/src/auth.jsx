import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api, { loadStoredAuth, storeAuth } from './api'

/**
 * AuthContext — the single source of truth for the signed-in user.
 *
 * On mount it restores any persisted session and verifies it against
 * GET /auth/me (so revoked tokens can't linger). login/signup/logout all go
 * through here so pages never touch tokens directly.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // auth: { token, user } | null
  const [auth, setAuth] = useState(loadStoredAuth)
  const [status, setStatus] = useState(() => (loadStoredAuth() ? 'restoring' : 'anonymous'))

  useEffect(() => {
    let active = true

    if (!auth) {
      setStatus('anonymous')
      return undefined
    }

    setStatus('restoring')
    api
      .get('/auth/me')
      .then((response) => {
        if (!active) return
        const next = { token: auth.token, user: response.data.user }
        setAuth(next)
        storeAuth(next)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        storeAuth(null)
        setAuth(null)
        setStatus('anonymous')
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setAuth(null)
      setStatus('anonymous')
    }
    window.addEventListener('scheduleai:unauthorized', onUnauthorized)
    return () => window.removeEventListener('scheduleai:unauthorized', onUnauthorized)
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    const next = { token: data.token, user: data.user }
    storeAuth(next)
    setAuth(next)
    setStatus('authenticated')
    return data.user
  }

  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload)
    const next = { token: data.token, user: data.user }
    storeAuth(next)
    setAuth(next)
    setStatus('authenticated')
    return { user: data.user, tenant: data.tenant }
  }

  function logout() {
    storeAuth(null)
    setAuth(null)
    setStatus('anonymous')
  }

  const value = useMemo(
    () => ({
      user: auth?.user || null,
      isAdmin: auth?.user?.role === 'owner' || auth?.user?.role === 'admin',
      status,
      login,
      signup,
      logout,
    }),
    // login/signup/logout are stable closures over setState — safe to omit.
    [auth, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Context files conventionally export both the provider and its hook from one
// place, so the react-refresh "components only" rule is intentionally relaxed.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
