import { useState } from 'react'
import TaskCard from './TaskCard.jsx'
import TaskActionModal from './TaskActionModal.jsx'

function hourLabel(dueTime) {
  if (!dueTime) return 'Anytime'
  const [h] = dueTime.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12} ${period}`
}

function groupByHour(tasks) {
  const groups = {}
  tasks.forEach((t) => {
    const key = hourLabel(t.dueTime)
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return Object.entries(groups).sort((a, b) => {
    const ta = a[1][0].dueTime || '99:99'
    const tb = b[1][0].dueTime || '99:99'
    return ta.localeCompare(tb)
  })
}

export default function TaskBoard({ tasks, onAction, isFuture }) {
  const [openTask, setOpenTask] = useState(null)

  const overdue = tasks.filter((t) => t.status === 'PENDING' && t.overdue)
  const upcoming = tasks.filter((t) => (t.status === 'PENDING' && !t.overdue) || t.status === 'SCHEDULED')
  const paused = tasks.filter((t) => t.status === 'PAUSED')
  const snoozed = tasks.filter((t) => t.status === 'SNOOZED')
  const done = tasks.filter((t) => ['DONE', 'NOT_DONE', 'SKIPPED', 'PARTIAL'].includes(t.status))

  if (tasks.length === 0) {
    return <div className="empty-state"><span className="empty-icon">◌</span>NOTHING SCHEDULED{isFuture ? '' : ' TODAY'}</div>
  }

  const upcomingGroups = groupByHour(upcoming)

  return (
    <div className="board">
      {overdue.length > 0 && (
        <>
          <div className="group-label">Overdue</div>
          <div className="card-list">
            {overdue.map((t) => <TaskCard key={t.occurrenceId} task={t} onOpen={setOpenTask} />)}
          </div>
        </>
      )}

      {upcomingGroups.map(([hour, group]) => (
        <div key={hour}>
          <div className="group-label">{hour} · {group.length} task{group.length > 1 ? 's' : ''}</div>
          <div className="card-list">
            {group.map((t) => <TaskCard key={t.occurrenceId} task={t} onOpen={setOpenTask} />)}
          </div>
        </div>
      ))}

      {paused.length > 0 && (
        <>
          <div className="group-label">Paused for the day</div>
          <div className="card-list">
            {paused.map((t) => <TaskCard key={t.occurrenceId} task={t} onOpen={setOpenTask} />)}
          </div>
        </>
      )}

      {snoozed.length > 0 && (
        <>
          <div className="group-label">Snoozed</div>
          <div className="card-list">
            {snoozed.map((t) => <TaskCard key={t.occurrenceId} task={t} onOpen={setOpenTask} />)}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="group-label">Completed</div>
          <div className="card-list">
            {done.map((t) => <TaskCard key={t.occurrenceId} task={t} onOpen={setOpenTask} />)}
          </div>
        </>
      )}

      {openTask && (
        <TaskActionModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onConfirm={(status, remark, snoozeUntil) => { onAction(openTask, status, remark, snoozeUntil); setOpenTask(null) }}
        />
      )}
    </div>
  )
}
