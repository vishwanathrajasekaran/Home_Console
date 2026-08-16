import TaskRow from './TaskRow.jsx'
import DayTimeline from './DayTimeline.jsx'
import StatsDonut from './StatsDonut.jsx'

export default function TaskBoard({ tasks, onAction, isFuture }) {
  const overdue = tasks.filter((t) => t.status === 'PENDING' && t.overdue)
  const pending = tasks.filter((t) => t.status === 'PENDING' && !t.overdue)
  const paused = tasks.filter((t) => t.status === 'PAUSED')
  const scheduled = tasks.filter((t) => t.status === 'SCHEDULED')
  const done = tasks.filter((t) => !['PENDING', 'PAUSED', 'SCHEDULED'].includes(t.status))
  const doneCount = done.filter((t) => t.status === 'DONE').length

  if (tasks.length === 0) {
    return <div className="empty-state"><span className="empty-icon">◌</span>NOTHING SCHEDULED{isFuture ? '' : ' TODAY'}</div>
  }

  return (
    <div className="board">
      <DayTimeline tasks={tasks} />

      <div className="status-strip">
        {!isFuture && (
          <>
            <div className="status-cell pending"><span className="num">{pending.length}</span><span className="lbl">Pending</span></div>
            <div className="status-cell overdue"><span className="num">{overdue.length}</span><span className="lbl">Overdue</span></div>
            <div className="status-cell done"><span className="num">{doneCount}</span><span className="lbl">Done</span></div>
          </>
        )}
        {!isFuture && <StatsDonut tasks={tasks} />}
      </div>

      {overdue.length > 0 && (
        <>
          <div className="group-label">Overdue</div>
          {overdue.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
        </>
      )}

      {pending.length > 0 && (
        <>
          <div className="group-label">{isFuture ? 'Planned' : 'Today'}</div>
          {pending.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
        </>
      )}

      {scheduled.length > 0 && (
        <>
          <div className="group-label">Scheduled</div>
          {scheduled.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
        </>
      )}

      {paused.length > 0 && (
        <>
          <div className="group-label">Paused for the day</div>
          {paused.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="group-label">Completed</div>
          {done.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
        </>
      )}
    </div>
  )
}
