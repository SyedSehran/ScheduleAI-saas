import { useState } from 'react'
import { LogIn, AlertCircle } from 'lucide-react'

export default function StudentLogin({ onLoginSuccess, students }) {
  const [name, setName] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Simulate API call delay
    setTimeout(() => {
      const student = students.find(
        (s) => s.name.toLowerCase() === name.toLowerCase() && s.enrollmentNo === enrollmentNo
      )

      if (student) {
        onLoginSuccess(student)
      } else {
        setError('Invalid credentials. Please check your name and enrollment number.')
      }
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="glass-elevated p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-400 to-purple-500 p-4 rounded-2xl">
                <LogIn size={32} className="text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">ScheduleAI</h1>
            <p className="text-slate-300">Student Portal</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                placeholder="e.g., Raj Kumar"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none transition"
              />
            </div>

            {/* Enrollment Number Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Enrollment Number</label>
              <input
                type="text"
                value={enrollmentNo}
                onChange={(e) => {
                  setEnrollmentNo(e.target.value.toUpperCase())
                  setError('')
                }}
                placeholder="e.g., CSE-2024-001"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none transition"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/50">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !name || !enrollmentNo}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="text-center space-y-2 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-400">Demo Credentials:</p>
            <div className="space-y-1 text-xs">
              <p className="text-slate-300">
                <span className="font-mono bg-slate-800 px-2 py-1 rounded">Raj Kumar / CSE-2024-001</span>
              </p>
              <p className="text-slate-300">
                <span className="font-mono bg-slate-800 px-2 py-1 rounded">Priya Singh / CSE-2024-002</span>
              </p>
              <p className="text-slate-300">
                <span className="font-mono bg-slate-800 px-2 py-1 rounded">Arjun Patel / ECE-2024-001</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-6 text-slate-400 text-sm">
          <p>Contact your department office for login assistance</p>
        </div>
      </div>
    </div>
  )
}
