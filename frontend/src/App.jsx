import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Home,
  Book,
  Users,
  Settings,
  LayoutGrid,
  LogOut,
  Sparkles,
} from 'lucide-react'
import api, { apiErrorMessage } from './api'
import { useAuth } from './auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CoursesPage from './pages/CoursesPage'
import SchedulePage from './pages/SchedulePage'
import TeachingLoadPage from './pages/TeachingLoadPage'
import SettingsPage from './pages/SettingsPage'
import { plannerFromData, defaultDays, defaultTimes } from './pages/helpers'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['owner', 'admin'] },
  { id: 'courses', label: 'Courses', icon: Book, roles: ['owner', 'admin'] },
  { id: 'schedule', label: 'Schedule', icon: LayoutGrid, roles: ['owner', 'admin', 'faculty', 'student'] },
  { id: 'teaching', label: 'Teaching Load', icon: Users, roles: ['owner', 'admin'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] },
]

const emptyPlanner = {
  campusName: 'ScheduleAI Campus',
  rooms: [],
  globalRules: { blockedTimes: ['12:00'], notes: [] },
  courses: [],
}

/**
 * App shell: authentication gate + sidebar navigation + page routing.
 *
 * All server calls go through the `api` axios instance, which attaches the
 * JWT and centralises 401 handling — pages themselves stay focused on UI.
 */
export default function App() {
  const { user, isAdmin, status, logout } = useAuth()

  const [planner, setPlanner] = useState(emptyPlanner)
  const [data, setData] = useState(null) // { parsed, schedule }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [apiStatus, setApiStatus] = useState('Connecting…')
  const [currentPage, setCurrentPage] = useState('schedule')
  const [isGenerating, setIsGenerating] = useState(false)
  const demoCache = useRef(null)
  const messageTimer = useRef(null)

  // Transient toast helper — auto-clears so messages never go stale.
  const flashMessage = useCallback((text) => {
    setMessage(text)
    setError('')
    clearTimeout(messageTimer.current)
    messageTimer.current = setTimeout(() => setMessage(''), 4000)
  }, [])

  const flashError = useCallback((text) => {
    setError(text)
    setMessage('')
    clearTimeout(messageTimer.current)
    messageTimer.current = setTimeout(() => setError(''), 5000)
  }, [])

  useEffect(() => () => clearTimeout(messageTimer.current), [])

  // ---- bootstrap ----------------------------------------------------------
  useEffect(() => {
    if (!user) return undefined

    let active = true

    async function bootstrapAdmin() {
      try {
        const [{ data: health }, { data: demo }] = await Promise.all([
          api.get('/health'),
          api.get('/demo'),
        ])
        if (!active) return
        demoCache.current = demo
        setApiStatus(health?.ollamaEnabled ? 'Ollama AI ready' : 'Planner ready')
        if ((demo.courses || []).length) {
          setPlanner(plannerFromData(demo))
        }
      } catch {
        if (!active) return
        setApiStatus('Backend offline')
        flashError('Cannot reach the API. Start the backend on port 4000.')
      }
    }

    async function loadPublishedTimetables() {
      // Faculty/student are read-only in RBAC — show the latest published
      // timetable of their institution.
      try {
        const { data: payload } = await api.get('/timetables')
        if (!active) return
        const latest = payload.data?.[0]
        if (latest) {
          setData({ parsed: latest.parsed, schedule: latest.schedule })
          setApiStatus(`${latest.name || 'Published'} timetable loaded`)
        } else {
          setApiStatus('No published timetable yet')
        }
      } catch {
        if (!active) return
        setApiStatus('Could not load published timetables')
      }
    }

    if (isAdmin) {
      setCurrentPage('dashboard')
      bootstrapAdmin()
    } else {
      setCurrentPage('schedule')
      loadPublishedTimetables()
    }

    return () => {
      active = false
    }
  }, [user, isAdmin, flashError])

  // ---- actions ------------------------------------------------------------
  async function generateSchedule() {
    setError('')
    setMessage('')
    setIsGenerating(true)
    try {
      const response = await api.post('/schedule', { inputData: planner })
      setData(response.data)
      flashMessage(
        response.data.schedule?.conflicts?.length
          ? `Timetable generated — ${response.data.schedule.conflicts.length} class(es) could not be placed. See metrics.`
          : 'Timetable generated successfully.',
      )
    } catch (requestError) {
      if (requestError.response?.status === 403 && requestError.response?.data?.canUpgrade) {
        flashError('Monthly generation limit reached for your plan. Upgrade to keep generating.')
      } else {
        flashError(apiErrorMessage(requestError, 'Unable to generate the timetable right now.'))
      }
    } finally {
      setIsGenerating(false)
    }
  }

  function loadDemo() {
    if (demoCache.current) {
      setPlanner(plannerFromData(demoCache.current))
      flashMessage('Demo dataset loaded into the planner.')
    }
  }

  // ---- gates --------------------------------------------------------------
  if (status === 'restoring') {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="h-10 w-10 text-cyan-300 animate-pulse" />
          <p className="text-slate-300 text-sm">Restoring your session…</p>
        </div>
      </div>
    )
  }

  if (!user || status !== 'authenticated') {
    return <LoginPage />
  }

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role))
  const days = data?.schedule?.days || defaultDays
  const times = data?.schedule?.times || defaultTimes
  const teachers = [
    ...new Set([
      ...(planner.courses || []).map((course) => course.faculty),
      ...((data?.schedule?.assignments || []).map((item) => item.originalFaculty || item.faculty)),
    ]),
  ].filter(Boolean)

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center gap-8 py-6 glass-elevated"
        style={{ borderRight: '1px solid rgba(161, 165, 176, 0.12)' }}
      >
        <div className="liquid-glass-icon cyan animate-scale-in">
          <Sparkles className="h-6 w-6" />
        </div>

        <nav className="flex flex-col gap-6" style={{ marginTop: '3rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentPage(item.id)}
                className="relative w-12 h-12 glass-button transition-all flex items-center justify-center"
                style={{
                  backgroundColor: currentPage === item.id ? 'rgba(161, 165, 176, 0.2)' : 'transparent',
                  color: currentPage === item.id ? '#a1a5b0' : '#94a3b8',
                }}
                title={item.label}
              >
                <Icon className="h-6 w-6" />
                {currentPage === item.id && (
                  <span
                    className="absolute -right-32 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium glass-elevated animate-fade-in-down"
                    style={{ color: '#e2e8f0' }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Signed-in identity + logout */}
        <div className="mt-auto flex flex-col gap-4 items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {(user.name || '?').split(' ').map((part) => part.charAt(0).toUpperCase()).slice(0, 2).join('')}
              </span>
            </div>
            <p className="text-xs text-center text-slate-400 truncate max-w-16" title={`${user.name} (${user.role})`}>
              {(user.name || '').split(' ')[0]}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-12 h-12 glass-button transition-all flex items-center justify-center hover:bg-red-500/20 rounded-xl"
            title={`Sign out ${user.email}`}
          >
            <LogOut className="h-5 w-5 text-red-400" />
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 ml-20">
        {currentPage === 'dashboard' && isAdmin && (
          <DashboardPage
            planner={planner}
            setPlanner={setPlanner}
            apiStatus={apiStatus}
            metrics={data?.schedule?.metrics || {}}
            message={message}
            error={error}
            go={setCurrentPage}
            loadDemo={loadDemo}
          />
        )}

        {currentPage === 'courses' && isAdmin && (
          <CoursesPage
            planner={planner}
            setPlanner={setPlanner}
            data={data}
            setData={setData}
            teachers={teachers}
            days={days}
            notify={flashMessage}
            fail={flashError}
          />
        )}

        {currentPage === 'schedule' && (
          <SchedulePage
            data={data}
            planner={planner}
            days={days}
            times={times}
            metrics={data?.schedule?.metrics || {}}
            isGenerating={isGenerating}
            onGenerate={generateSchedule}
            notify={flashMessage}
            fail={flashError}
          />
        )}

        {currentPage === 'teaching' && isAdmin && (
          <TeachingLoadPage
            planner={planner}
            setPlanner={setPlanner}
            data={data}
            setData={setData}
            notify={flashMessage}
            fail={flashError}
          />
        )}

        {currentPage === 'settings' && isAdmin && (
          <SettingsPage planner={planner} setPlanner={setPlanner} />
        )}
      </main>
    </div>
  )
}
