const STATUS_COLOR = {
  PENDING: 'var(--amber)', DONE: 'var(--green)', NOT_DONE: 'var(--red)',
  SKIPPED: 'var(--text-faint)', PARTIAL: 'var(--amber)', PAUSED: 'var(--blue)', SCHEDULED: 'var(--blue)',
}

export default function DayTimeline({ tasks }) {
  if (tasks.length === 0) return null

  return (
    <div className="timeline-wrap">
      <div className="timeline-track">
        <div className="timeline-axis" />
        {tasks.filter((t) => t.dueTime).map((t) => {
          const [h, m] = t.dueTime.split(':').map(Number)
          const pct = ((h + m / 60) / 24) * 100
          const color = STATUS_COLOR[t.status] || 'var(--text-faint)'
          return (
            <a key={t.occurrenceId} href={`#row-${t.occurrenceId}`} className="timeline-dot" style={{ left: `${pct}%`, color }} title={`${t.name} — ${t.dueTime}`}>
              <span className="timeline-dot-mark" />
            </a>
          )
        })}
      </div>
      <div className="timeline-labels">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
      </div>
    </div>
  )
}
