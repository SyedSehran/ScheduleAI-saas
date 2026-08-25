/** Small shared form primitives used across every page. */

export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
      style={{
        borderColor: '#E5E7EB',
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        ...(props.style || {}),
      }}
      onFocus={(e) => { e.target.style.borderColor = '#4F46E5'; props.onFocus?.(e) }}
      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; props.onBlur?.(e) }}
    />
  )
}

export function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
      style={{
        borderColor: '#E5E7EB',
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        ...(props.style || {}),
      }}
      onFocus={(e) => { e.target.style.borderColor = '#4F46E5'; props.onFocus?.(e) }}
      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; props.onBlur?.(e) }}
    />
  )
}

export function Banner({ tone = 'info', children }) {
  const toneClass = { info: 'glass-green', error: 'glass-pink', warn: 'glass-orange' }[tone] || 'glass-green'
  if (!children) return null
  return <div className={`rounded-2xl px-4 py-3 text-sm ${toneClass}`}>{children}</div>
}
