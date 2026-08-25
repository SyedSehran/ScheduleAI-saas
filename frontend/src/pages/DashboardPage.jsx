import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Sparkles, Book, FileUp, Users, UserPlus, LoaderCircle } from 'lucide-react'
import api, { apiErrorMessage } from '../api'
import { Field, Input } from '../components/ui'

const statCards = [
  ['generationTimeLabel', 'Generation'],
  ['scheduledSessions', 'Hours Scheduled'],
  ['unscheduledSessions', 'Hours Pending'],
  ['substitutionCount', 'Substitutions'],
]

/**
 * Landing page: hero + planner snapshot. For owners/admins it also loads the
 * /admin/dashboard payload (plan usage metering, team roles, invitations) so
 * the SaaS admin story is visible right on the first screen.
 */
export default function DashboardPage({
  planner,
  setPlanner,
  apiStatus,
  metrics,
  message,
  error,
  go,
  loadDemo,
}) {
  const [adminSummary, setAdminSummary] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('faculty')
  const [inviteState, setInviteState] = useState({ loading: false, note: '' })

  useEffect(() => {
    let active = true
    api
      .get('/admin/dashboard')
      .then(({ data }) => {
        if (active) setAdminSummary(data)
      })
      .catch(() => {
        // Dashboard summary is a bonus panel; ignore failures silently.
      })
    return () => {
      active = false
    }
  }, [])

  async function sendInvite(event) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteState({ loading: true, note: '' })
    try {
      await api.post('/auth/invitations', { email: inviteEmail.trim(), role: inviteRole })
      setInviteState({
        loading: false,
        note: `Invitation created for ${inviteEmail.trim()} — they can join via accept-invite with the token.`,
      })
      setInviteEmail('')
      setAdminSummary((current) =>
        current
          ? { ...current, invitations: [{ email: inviteEmail.trim(), role: inviteRole }, ...(current.invitations || [])] }
          : current,
      )
    } catch (inviteError) {
      setInviteState({
        loading: false,
        note: apiErrorMessage(inviteError, 'Could not create the invitation.'),
      })
    }
  }

  function downloadExcelTemplate() {
    const templateData = [
      {
        Teacher: 'Dr. Smith',
        Course: 'Data Structures',
        Sections: 'CSE-A, CSE-B',
        'Theory Hours': 3,
        'Practical Hours': 1,
        'Required Lectures': 42,
        'Preferred Days': 'Monday, Wednesday',
        'Blocked Days': 'Friday',
        'Preferred Band': 'morning',
        'Room Type': 'lecture',
        'Student Count': 60,
      },
      {
        Teacher: 'Prof. Johnson',
        Course: 'Web Development',
        Sections: 'CSE-A',
        'Theory Hours': 2,
        'Practical Hours': 2,
        'Required Lectures': 28,
        'Preferred Days': 'Tuesday, Thursday',
        'Blocked Days': '',
        'Preferred Band': 'afternoon',
        'Room Type': 'lab',
        'Student Count': 40,
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Courses')
    XLSX.writeFile(wb, 'ScheduleAI_CourseTemplate.xlsx')
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="glass-elevated overflow-hidden animate-fade-in-up">
          <div className="p-8">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium glass-cyan">
                  <Sparkles className="h-4 w-4" style={{ color: '#a1a5b0' }} />
                  ScheduleAI
                </span>
                <h1
                  className="max-w-3xl font-['Space_Grotesk',sans-serif] text-4xl font-semibold leading-tight md:text-5xl"
                  style={{ color: '#e2e8f0' }}
                >
                  Academic scheduling with a polished control room for timetable generation and full-day teacher substitutions.
                </h1>
                <p className="max-w-2xl text-base leading-7" style={{ color: '#cbd5e1' }}>
                  Plan syllabus coverage, generate a multi-section timetable, and when a faculty member is absent,
                  choose only the teacher and day. The system assigns substitutes period-by-period on its own.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="glass-cyan p-4 animate-scale-in">
                    <p className="text-xs uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>Status</p>
                    <p className="mt-2 text-sm" style={{ color: '#a1a5b0' }}>{apiStatus}</p>
                  </div>
                  <div className="glass-green p-4 animate-scale-in">
                    <p className="text-xs uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>Rooms</p>
                    <p className="mt-2 text-sm" style={{ color: '#d1d5db' }}>{planner.rooms.length} available</p>
                  </div>
                  <div className="glass-purple p-4 animate-scale-in">
                    <p className="text-xs uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>Substitution</p>
                    <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>Auto-cover full day</p>
                  </div>
                </div>
              </div>

              <div className="glass-elevated p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Campus">
                    <Input
                      value={planner.campusName}
                      onChange={(event) => setPlanner((current) => ({ ...current, campusName: event.target.value }))}
                    />
                  </Field>
                  <Field label="Blocked times">
                    <Input
                      value={planner.globalRules.blockedTimes.join(', ')}
                      onChange={(event) =>
                        setPlanner((current) => ({
                          ...current,
                          globalRules: { ...current.globalRules, blockedTimes: event.target.value.split(',').map((t) => t.trim()).filter(Boolean) },
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {planner.rooms.map((room) => (
                    <span key={room.name} className="glass-purple px-3 py-2 text-xs animate-float" style={{ color: '#9ca3af' }}>
                      {[room.name, room.type, `cap ${room.capacity}`].join(' | ')}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => go('courses')} className="skeu-button-glossy inline-flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    Manage Courses
                  </button>
                  <button type="button" onClick={downloadExcelTemplate} className="skeu-button-premium inline-flex items-center gap-2">
                    <FileUp className="h-4 w-4" />
                    Download Template
                  </button>
                  <button type="button" onClick={loadDemo} className="glass-button inline-flex items-center gap-2">
                    Load demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {message ? <div className="mt-5 glass-green px-4 py-3 text-sm animate-fade-in-down" style={{ color: '#d1d5db' }}>{message}</div> : null}
        {error ? <div className="mt-5 glass-pink px-4 py-3 text-sm animate-fade-in-down" style={{ color: '#9ca3af' }}>{error}</div> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(([key, label], idx) => {
            const glassColors = ['glass-cyan', 'glass-green', 'glass-orange', 'glass-purple']
            return (
              <article key={key} className={`${glassColors[idx % 4]} p-5 animate-scale-in`}>
                <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>{label}</p>
                <p className="mt-3 font-['Space_Grotesk',sans-serif] text-3xl" style={{ color: '#d1d5db' }}>{metrics[key] ?? '--'}</p>
              </article>
            )
          })}
        </div>

        {/* Plan usage & team — visible to owners/admins only */}
        {adminSummary ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <section className="glass-elevated p-6 animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-['Space_Grotesk',sans-serif] text-xl" style={{ color: '#e2e8f0' }}>Plan usage</h2>
                <span className="glass-cyan px-3 py-1 rounded-full text-xs uppercase tracking-widest" style={{ color: '#a1a5b0' }}>
                  {adminSummary.plan?.name || 'free'}
                </span>
              </div>
              <div className="flex items-end justify-between text-sm" style={{ color: '#94a3b8' }}>
                <span>Timetable generations this month</span>
                <span className="font-semibold" style={{ color: '#e2e8f0' }}>
                  {adminSummary.usage?.used ?? 0} / {adminSummary.usage?.limit ?? 0}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(148,163,184,0.2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(((adminSummary.usage?.used || 0) / Math.max(adminSummary.usage?.limit || 1, 1)) * 100, 100)}%`,
                    backgroundColor: '#4F46E5',
                  }}
                />
              </div>
              <p className="mt-3 text-xs" style={{ color: '#64748b' }}>
                Limits reset monthly and are enforced server-side with a 403 + upgrade hint.
              </p>
            </section>

            <section className="glass-elevated p-6 animate-scale-in">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5" style={{ color: '#a1a5b0' }} />
                <h2 className="font-['Space_Grotesk',sans-serif] text-xl" style={{ color: '#e2e8f0' }}>Team & invitations</h2>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(adminSummary.roleCounts || {}).map(([role, count]) => (
                  <span key={role} className="glass-purple px-3 py-1 rounded-full text-xs" style={{ color: '#9ca3af' }}>
                    {role}: {count}
                  </span>
                ))}
              </div>
              <form onSubmit={sendInvite} className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[180px]">
                    <Field label="Invite by email">
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="teacher@college.edu"
                      />
                    </Field>
                  </div>
                  <div className="w-32">
                    <Field label="Role">
                      <select
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value)}
                        className="w-full rounded-2xl border px-3 py-3 text-sm outline-none transition"
                        style={{ borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                      >
                        <option value="admin">admin</option>
                        <option value="faculty">faculty</option>
                        <option value="student">student</option>
                      </select>
                    </Field>
                  </div>
                  <button
                    type="submit"
                    disabled={inviteState.loading}
                    className="skeu-button-glossy inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {inviteState.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Invite
                  </button>
              </form>
              {inviteState.note ? (
                <p className="mt-3 text-xs" style={{ color: '#9ca3af' }}>{inviteState.note}</p>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  )
}
