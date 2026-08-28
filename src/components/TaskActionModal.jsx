import { useState } from 'react'
import { iconFor, categoryIcon } from '../lib/taskIcons.js'

const REASONS = ['No time', 'Out of supplies', 'Not needed today', 'Someone else did it', 'Other']

// Done and Pause confirm instantly — Pause is "off for today, no exceptions"
// by design, so it doesn't need a reason. If you want to note *why* with
// room for exceptions later, that's what Skip is for.
const INSTANT_STATUSES = ['DONE', 'PAUSED']

const ACTIONS = [
  { status: 'DONE', icon: '✓', label: 'Done', cls: 'action-done' },
  { status: 'NOT_DONE', icon: '✕', label: 'Not done', cls: 'action-notdone' },
  { status: 'SKIPPED', icon: '⏭', label: 'Skip', cls: 'action-skip' },
  { status: 'PAUSED', icon: '⏸', label: 'Pause', cls: 'action-pause' },
  { status: 'SNOOZED', icon: '⏰', label: 'Snooze', cls: 'action-snooze' },
]

function todayPlus(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TaskActionModal({ task, onClose, onConfirm }) {
  const [pendingStatus, setPendingStatus] = useState(null)
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')
  const [snoozeDate, setSnoozeDate] = useState(todayPlus(1))

  function pickAction(status) {
    if (INSTANT_STATUSES.includes(status)) {
      onConfirm(status, '')
      return
    }
    setPendingStatus(status)
  }

  const actionLabel = ACTIONS.find((a) => a.status === pendingStatus)?.label

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-head">
          <span className="task-icon lg">{iconFor(task.name)}</span>
          <div>
            <div className="modal-title">{task.name}</div>
            <div className="task-meta">
              <span className="due">{task.dueTime || 'anytime'}</span>
              <span className="assignee"><span className="avatar-dot" />{task.assignee}</span>
              {task.category && <span className="cat-tag">{categoryIcon(task.category)} {task.category}</span>}
            </div>
          </div>
        </div>

        {!pendingStatus && (
          <div className="action-grid">
            {ACTIONS.map((a) => (
              <button key={a.status} className={`action-btn ${a.cls}`} onClick={() => pickAction(a.status)}>
                <span className="action-icon">{a.icon}</span>
                <span className="action-label">{a.label}</span>
              </button>
            ))}
          </div>
        )}

        {pendingStatus === 'SNOOZED' && (
          <>
            <div className="modal-title" style={{ fontSize: 13, opacity: 0.7 }}>Snooze until when?</div>
            <div className="reason-chip-row">
              <button className={`reason-chip${snoozeDate === todayPlus(1) ? ' selected' : ''}`} onClick={() => setSnoozeDate(todayPlus(1))}>Tomorrow</button>
              <button className={`reason-chip${snoozeDate === todayPlus(3) ? ' selected' : ''}`} onClick={() => setSnoozeDate(todayPlus(3))}>In 3 days</button>
              <button className={`reason-chip${snoozeDate === todayPlus(7) ? ' selected' : ''}`} onClick={() => setSnoozeDate(todayPlus(7))}>Next week</button>
            </div>
            <input
              type="date"
              className="remark-input"
              style={{ minHeight: 'auto' }}
              value={snoozeDate}
              min={todayPlus(1)}
              onChange={(e) => setSnoozeDate(e.target.value)}
            />
            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setPendingStatus(null)}>Back</button>
              <button className="btn-primary" onClick={() => onConfirm('SNOOZED', '', snoozeDate)}>
                Snooze to {snoozeDate}
              </button>
            </div>
          </>
        )}

        {(pendingStatus === 'NOT_DONE' || pendingStatus === 'SKIPPED') && (
          <>
            <div className="modal-title" style={{ fontSize: 13, opacity: 0.7 }}>{actionLabel} — add a reason?</div>
            <div className="reason-chip-row">
              {REASONS.map((r) => (
                <button key={r} className={`reason-chip${reason === r ? ' selected' : ''}`} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <textarea
              className="remark-input"
              placeholder="Add a detail (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setPendingStatus(null)}>Back</button>
              <button className="btn-primary" onClick={() => onConfirm(pendingStatus, [reason, note].filter(Boolean).join(' — '))}>
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
