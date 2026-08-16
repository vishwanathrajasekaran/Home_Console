import { useState } from 'react'

const REASONS = ['No time', 'Out of supplies', 'Not needed today', 'Someone else did it', 'Other']

export default function RemarkModal({ task, status, onCancel, onConfirm }) {
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')

  const label = { NOT_DONE: 'Not done', SKIPPED: 'Skipped', PARTIAL: 'Partial' }[status]

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{task.name} — {label}</div>

        <div className="reason-chip-row">
          {REASONS.map((r) => (
            <button
              key={r}
              className={`reason-chip${reason === r ? ' selected' : ''}`}
              onClick={() => setReason(r)}
            >
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
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => onConfirm([reason, note].filter(Boolean).join(' — '))}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
