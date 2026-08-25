import DayTimeline from './DayTimeline.jsx'
import StatsDonut from './StatsDonut.jsx'

export default function BoardSummary({ tasks, isFuture }) {
  if (tasks.length === 0) return null

  const overdue = tasks.filter((t) => t.status === 'PENDING' && t.overdue)
  const upcoming = tasks.filter((t) => (t.status === 'PENDING' && !t.overdue) || t.status === 'SCHEDULED')
  const done = tasks.filter((t) => ['DONE', 'NOT_DONE', 'SKIPPED', 'PARTIAL'].includes(t.status))
  const doneCount = done.filter((t) => t.status === 'DONE').length

  return (
    <div className="board-summary">
      <DayTimeline tasks={tasks} />
      <div className="status-strip">
        {!isFuture && (
          <>
            <div className="status-cell pending"><span className="num">{upcoming.length}</span><span className="lbl">Pending</span></div>
            <div className="status-cell overdue"><span className="num">{overdue.length}</span><span className="lbl">Overdue</span></div>
            <div className="status-cell done"><span className="num">{doneCount}</span><span className="lbl">Done</span></div>
          </>
        )}
        {!isFuture && <StatsDonut tasks={tasks} />}
      </div>
    </div>
  )
}
