import { useState } from 'react'
import { iconFor, categoryIcon } from '../lib/taskIcons.js'

const REASONS = ['No time', 'Out of supplies', 'Not needed today', 'Someone else did it', 'Other']

const ACTIONS = [
  { status: 'DONE', icon: '✓', label: 'Done', cls: 'action-done' },
  { status: 'NOT_DONE', icon: '✕', label: 'Not done', cls: 'action-notdone' },
  { status: 'SKIPPED', icon: '⏭', label: 'Skip', cls: 'action-skip' },
  { status: 'PAUSED', icon: '⏸', label: 'Pause', cls: 'action-pause' },
]

export default function TaskActionModal({ task, onClose, onConfirm }) {
  const [pendingStatus, setPendingStatus] = useState(null)
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')

  function pickAction(status) {
    if (status === 'DONE') {
      onConfirm(status, '')
      return
    }
    setPendingStatus(status)
  }

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

        {!pendingStatus ? (
          <div className="action-grid">
            {ACTIONS.map((a) => (
              <button key={a.status} className={`action-btn ${a.cls}`} onClick={() => pickAction(a.status)}>
                <span className="action-icon">{a.icon}</span>
                <span className="action-label">{a.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="modal-title" style={{ fontSize: 13, opacity: 0.7 }}>
              {ACTIONS.find((a) => a.status === pendingStatus)?.label} — add a reason?
            </div>
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
