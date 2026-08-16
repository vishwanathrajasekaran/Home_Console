import TaskRow from './TaskRow.jsx'

export default function TaskBoard({ tasks, onAction }) {
  const overdue = tasks.filter((t) => t.status === 'PENDING' && t.overdue)
  const pending = tasks.filter((t) => t.status === 'PENDING' && !t.overdue)
  const done = tasks.filter((t) => t.status !== 'PENDING')
  const doneCount = done.filter((t) => t.status === 'DONE').length

  if (tasks.length === 0) {
    return <div className="empty-state"><span className="empty-icon">◌</span>NOTHING SCHEDULED TODAY</div>
  }

  return (
    <div className="board">
      <div className="status-strip">
        <div className="status-cell pending"><span className="num">{pending.length}</span><span className="lbl">Pending</span></div>
        <div className="status-cell overdue"><span className="num">{overdue.length}</span><span className="lbl">Overdue</span></div>
        <div className="status-cell done"><span className="num">{doneCount}</span><span className="lbl">Done</span></div>
      </div>

      {overdue.length > 0 && (
        <>
          <div className="group-label">Overdue</div>
          {overdue.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
        </>
      )}

      {pending.length > 0 && (
        <>
          <div className="group-label">Today</div>
          {pending.map((t) => <TaskRow key={t.occurrenceId} task={t} onAction={onAction} />)}
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
