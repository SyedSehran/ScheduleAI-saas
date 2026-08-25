import { useState } from 'react'
import { LogIn, AlertCircle, Sparkles, Building2, LoaderCircle } from 'lucide-react'
import { useAuth } from '../auth'
import { apiErrorMessage } from '../api'

const PLANS = [
  { value: 'free', label: 'Free — 3 timetables/month' },
  { value: 'pro', label: 'Pro — 100 timetables/month' },
  { value: 'enterprise', label: 'Enterprise — 1000/month' },
]

/**
 * Real JWT authentication against the backend:
 *   - Sign in with email + password (roles: owner / admin / faculty / student)
 *   - Create a new institution (signs you up as the tenant "owner")
 *   - One-click demo institution for quick interviews/demos
 */
export default function LoginPage() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    collegeName: '',
    name: '',
    email: '',
    password: '',
    plan: 'free',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password)
      } else {
        await signup({
          collegeName: form.collegeName.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          plan: form.plan,
        })
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Could not sign you in. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  /** Creates a throwaway institution so a live demo can start in one click. */
  async function handleDemoLogin() {
    setError('')
    setIsLoading(true)
    try {
      const stamp = Date.now().toString(36)
      await signup({
        collegeName: `Demo Institute ${stamp.slice(-4)}`,
        name: 'Demo Owner',
        email: `demo-owner-${stamp}@scheduleai.test`,
        password: `Demo!${stamp}pass`,
        plan: 'pro',
      })
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Demo signup failed — is the backend running?'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="glass-elevated p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-400 to-purple-500 p-4 rounded-2xl">
                <LogIn size={32} className="text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">ScheduleAI</h1>
            <p className="text-slate-300">Multi-tenant academic scheduling</p>
          </div>

          {/* Mode switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-800/70">
            {[
              ['login', 'Sign in'],
              ['signup', 'New institution'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value)
                  setError('')
                }}
                className={`py-2 rounded-lg text-sm font-medium transition ${
                  mode === value
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Institution name</label>
                  <input
                    type="text"
                    required
                    value={form.collegeName}
                    onChange={(e) => update('collegeName', e.target.value)}
                    placeholder="e.g., TechVision Institute"
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none transition"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Your full name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="e.g., Ananya Sharma"
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none transition"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@college.edu"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder={mode === 'signup' ? 'Minimum 8 characters' : 'Your password'}
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none transition"
              />
            </div>

            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) => update('plan', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white focus:border-blue-400 focus:outline-none transition"
                >
                  {PLANS.map((plan) => (
                    <option key={plan.value} value={plan.value}>{plan.label}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="flex gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/50">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {isLoading && <LoaderCircle size={18} className="animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create institution'}
            </button>
          </form>

          <div className="text-center pt-4 border-t border-slate-700 space-y-3">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition glass-button px-4 py-2 rounded-xl disabled:opacity-50"
            >
              <Sparkles size={16} className="text-cyan-300" />
              Instant demo institution
            </button>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Building2 size={12} />
              Owners invite faculty & students via email invitations
            </p>
          </div>
        </div>

        <div className="text-center mt-6 text-slate-400 text-sm">
          <p>Every institution gets an isolated, tenant-scoped workspace.</p>
        </div>
      </div>
    </div>
  )
}
