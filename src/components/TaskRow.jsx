import { iconFor } from '../lib/taskIcons.js'

export default function TaskRow({ task, onAction }) {
  const isDone = task.status === 'DONE'
  const isOverdue = task.status === 'PENDING' && task.overdue
  const isPreview = task.status === 'SCHEDULED'

  return (
    <div id={`row-${task.occurrenceId}`} className={`task-row priority-${task.priority || 'Routine'}${isOverdue ? ' overdue' : ''}${isDone ? ' done' : ''}${isPreview ? ' preview' : ''}`}>
      <span className="task-icon">{iconFor(task.name)}</span>
      <div className="task-body">
        <div className="task-name">{task.name}</div>
        <div className="task-meta">
          <span className="due">{task.dueTime || 'anytime'}</span>
          <span className="assignee"><span className="avatar-dot" />{task.assignee}</span>
        </div>
      </div>

      {task.status === 'PENDING' ? (
        <div className="task-actions">
          <button className="pill-btn done-btn" onClick={() => onAction(task, 'DONE')}>Done</button>
          <button className="pill-btn notdone-btn" onClick={() => onAction(task, 'NOT_DONE')}>Not done</button>
          <button className="pill-btn skip-btn" onClick={() => onAction(task, 'SKIPPED')}>Skip</button>
          <button className="pill-btn pause-btn" title="Pause for today" onClick={() => onAction(task, 'PAUSED')}>⏸</button>
        </div>
      ) : isPreview ? (
        <span className="status-tag SCHEDULED">Scheduled</span>
      ) : (
        <span className={`status-tag ${task.status}`}>{task.status.replace('_', ' ')}</span>
      )}
    </div>
  )
}
