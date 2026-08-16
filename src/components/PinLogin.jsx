import { useState } from 'react'
import { initials } from '../lib/taskIcons.js'

const PIN_LENGTH = 4

export default function PinLogin({ users, onLogin, error, busy }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')

  function pressKey(digit) {
    if (!selected || pin.length >= PIN_LENGTH || busy) return
    const next = pin + digit
    setPin(next)
    if (next.length === PIN_LENGTH) {
      onLogin(selected.id, next, () => setTimeout(() => setPin(''), 400))
    }
  }

  function backspace() { setPin((p) => p.slice(0, -1)) }

  return (
    <div className="login-shell">
      <div className="login-mark" />
      <div>
        <div className="login-title">Home Console</div>
        <div className="login-sub">SELECT YOUR NAME · ENTER PIN</div>
      </div>

      <div className="user-grid">
        {users.map((u) => (
          <button
            key={u.id}
            className={`user-tile${selected?.id === u.id ? ' active' : ''}`}
            onClick={() => { setSelected(u); setPin('') }}
          >
            <div className="user-avatar">{initials(u.name)}</div>
            <div className="user-name">{u.name}</div>
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="pin-dots">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span key={i} className={`pin-dot${i < pin.length ? (error ? ' error' : ' filled') : ''}`} />
            ))}
          </div>

          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9].map((n) => (
              <button key={n} className="key-btn" onClick={() => pressKey(String(n))}>{n}</button>
            ))}
            <button className="key-btn ghost" onClick={() => { setPin(''); setSelected(null) }}>cancel</button>
            <button className="key-btn" onClick={() => pressKey('0')}>0</button>
            <button className="key-btn ghost" onClick={backspace}>⌫</button>
          </div>

          {error && <div className="error-line">{error}</div>}
        </>
      )}
    </div>
  )
}
