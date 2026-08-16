import { useState } from 'react'

function pad(n) { return String(n).padStart(2, '0') }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export default function Calendar({ selectedDate, onSelect, onClose }) {
  const initial = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
  const [viewMonth, setViewMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))

  const todayKey = toKey(new Date())
  const firstDow = viewMonth.getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet calendar-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-header">
          <button className="cal-nav" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button>
          <div className="modal-title">{monthLabel}</div>
          <button className="cal-nav" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button>
        </div>

        <div className="cal-grid cal-dow">
          {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="cal-dow-cell">{d}</div>)}
        </div>

        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="cal-cell empty" />
            const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
            const key = toKey(date)
            const isToday = key === todayKey
            const isSelected = key === selectedDate
            return (
              <button
                key={i}
                className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                onClick={() => { onSelect(key); onClose() }}
              >
                {day}
              </button>
            )
          })}
        </div>

        <button className="btn-secondary" style={{ marginTop: 14, width: '100%' }} onClick={() => { onSelect(todayKey); onClose() }}>
          Jump to today
        </button>
      </div>
    </div>
  )
}
