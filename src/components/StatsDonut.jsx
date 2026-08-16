export default function StatsDonut({ tasks }) {
  const counts = {
    DONE: tasks.filter((t) => t.status === 'DONE').length,
    NOT_DONE: tasks.filter((t) => t.status === 'NOT_DONE').length,
    SKIPPED: tasks.filter((t) => t.status === 'SKIPPED').length,
    PAUSED: tasks.filter((t) => t.status === 'PAUSED').length,
    PENDING: tasks.filter((t) => t.status === 'PENDING' || t.status === 'SCHEDULED').length,
  }
  const total = tasks.length || 1
  const segments = [
    { key: 'DONE', color: 'var(--green)', value: counts.DONE },
    { key: 'NOT_DONE', color: 'var(--red)', value: counts.NOT_DONE },
    { key: 'SKIPPED', color: 'var(--text-faint)', value: counts.SKIPPED },
    { key: 'PAUSED', color: 'var(--blue)', value: counts.PAUSED },
    { key: 'PENDING', color: 'var(--amber)', value: counts.PENDING },
  ].filter((s) => s.value > 0)

  const R = 30, C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="donut-wrap">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--border-soft)" strokeWidth="9" />
        {segments.map((s) => {
          const frac = s.value / total
          const dash = frac * C
          const el = (
            <circle
              key={s.key}
              cx="38" cy="38" r={R} fill="none" stroke={s.color} strokeWidth="9"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 38 38)"
              strokeLinecap="butt"
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="donut-legend">
        {segments.map((s) => (
          <div key={s.key} className="donut-legend-item">
            <span className="donut-dot" style={{ background: s.color }} />
            {s.key.replace('_', ' ')} · {s.value}
          </div>
        ))}
      </div>
    </div>
  )
}
