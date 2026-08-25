import axios from 'axios'

/**
 * Single configured axios instance for the whole app.
 *
 * - Attaches the JWT from localStorage to every request.
 * - On a 401 response (expired/invalid token) the stored session is wiped and
 *   an event is broadcast so the AuthProvider can return the user to login.
 */
const AUTH_STORAGE_KEY = 'scheduleai.auth'

export function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed?.token && parsed?.user) return parsed
    return null
  } catch {
    return null
  }
}

export function storeAuth(auth) {
  try {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    // Private-mode browsers can block storage; the app still works per-session.
  }
}

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // solver runs on large datasets can take a while
})

api.interceptors.request.use((config) => {
  const auth = loadStoredAuth()
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/signup')
    if (error.response?.status === 401 && !isAuthCall) {
      storeAuth(null)
      window.dispatchEvent(new Event('scheduleai:unauthorized'))
    }
    return Promise.reject(error)
  },
)

/** Extract a friendly message from an axios error thrown by the API. */
export function apiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error || error?.response?.data?.detail || fallback
}

export default api
