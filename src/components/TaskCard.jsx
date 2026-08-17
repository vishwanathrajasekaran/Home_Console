import { iconFor, categoryIcon } from '../lib/taskIcons.js'

export default function TaskCard({ task, onOpen }) {
  const isOverdue = task.status === 'PENDING' && task.overdue
  const isActionable = task.status === 'PENDING'
  const isDoneLike = ['DONE', 'NOT_DONE', 'SKIPPED', 'PARTIAL'].includes(task.status)

  return (
    <button
      id={`row-${task.occurrenceId}`}
      className={`task-card priority-${task.priority || 'Routine'}${isOverdue ? ' overdue' : ''}${isDoneLike ? ' done' : ''}`}
      onClick={() => isActionable && onOpen(task)}
      disabled={!isActionable}
    >
      <span className="task-icon">{iconFor(task.name)}</span>
      <div className="task-card-body">
        <div className="task-name">{task.name}</div>
        <div className="task-meta">
          <span className="due">{task.dueTime || 'anytime'}</span>
          <span className="assignee"><span className="avatar-dot" />{task.assignee}</span>
          {task.category && <span className="cat-tag">{categoryIcon(task.category)}</span>}
        </div>
      </div>
      {task.status !== 'PENDING' && (
        <span className={`status-tag ${task.status}`}>{task.status.replace('_', ' ')}</span>
      )}
      {isOverdue && <span className="overdue-pulse" />}
    </button>
  )
}
