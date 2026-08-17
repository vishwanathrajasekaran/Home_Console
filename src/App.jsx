import { useEffect, useState, useCallback } from 'react'
import PinLogin from './components/PinLogin.jsx'
import TaskBoard from './components/TaskBoard.jsx'
import Calendar from './components/Calendar.jsx'
import { api } from './lib/api.js'
import { isSubscribed, subscribeToPush } from './lib/push.js'
import { getStoredPreference, setStoredPreference, resolveTheme, applyTheme } from './lib/theme.js'

const SESSION_KEY = 'home-ops-session'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const [users, setUsers] = useState(null)
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })
  const [loginError, setLoginError] = useState(null)
  const [loginBusy, setLoginBusy] = useState(false)

  const [viewedDate, setViewedDate] = useState(todayKey())
  const [tasks, setTasks] = useState(null)
  const [boardError, setBoardError] = useState(null)
  const [pushOn, setPushOn] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [themePref, setThemePref] = useState(getStoredPreference())

  useEffect(() => {
    applyTheme(resolveTheme(themePref))
  }, [themePref])

  useEffect(() => {
    api.getUsers().then((d) => setUsers(d.users)).catch((e) => setBoardError(e.message))
  }, [])

  const refreshBoard = useCallback(() => {
    if (!session) return
    setBoardError(null)
    setTasks(null) // show the loading state immediately, including on date switches
    const call = viewedDate === todayKey() ? api.getToday(session.userId) : api.getForDate(session.userId, viewedDate)
    call.then((d) => setTasks(d.tasks)).catch((e) => setBoardError(e.message))
  }, [session, viewedDate])

  useEffect(() => { refreshBoard() }, [refreshBoard])

  useEffect(() => {
    if (session) isSubscribed().then(setPushOn)
  }, [session])

  function handleLogin(userId, pin, onFail) {
    setLoginBusy(true)
    setLoginError(null)
    api.login(userId, pin)
      .then((d) => {
        if (!d.ok) throw new Error('Wrong PIN')
        const s = { userId, name: d.name, role: d.role }
        localStorage.setItem(SESSION_KEY, JSON.stringify(s))
        setSession(s)
        onFail() // clears the "verifying" state on success too
      })
      .catch((e) => { setLoginError(e.message); onFail() })
      .finally(() => setLoginBusy(false))
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setTasks(null)
    setViewedDate(todayKey())
  }

  function handleAction(task, status, remark) {
    setTasks((prev) => prev.map((t) => t.occurrenceId === task.occurrenceId ? { ...t, status } : t))
    api.updateOccurrence({ occurrenceId: task.occurrenceId, status, remark: remark || '', userId: session.userId })
      .catch(() => refreshBoard())
  }

  async function enablePush() {
    try {
      const sub = await subscribeToPush()
      await api.saveSubscription(session.userId, sub)
      setPushOn(true)
    } catch (e) {
      alert(e.message)
    }
  }

  function cycleTheme() {
    const order = ['auto', 'day', 'night']
    const next = order[(order.indexOf(themePref) + 1) % order.length]
    setThemePref(next)
    setStoredPreference(next)
  }

  if (!users) return <div className="load-line">LOADING HOME CONSOLE…</div>

  if (!session) {
    return <PinLogin users={users} onLogin={handleLogin} error={loginError} busy={loginBusy} />
  }

  const isToday = viewedDate === todayKey()
  const dateObj = new Date(viewedDate + 'T00:00:00')
  const dateLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
  const hour = new Date().getHours()
  const greetWord = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

  const doneCount = (tasks || []).filter((t) => t.status === 'DONE').length
  const totalCount = (tasks || []).length
  const pct = totalCount > 0 ? doneCount / totalCount : 0
  const R = 22
  const circumference = 2 * Math.PI * R

  const themeIcon = { auto: '◐', day: '☀', night: '☾' }[themePref]

  return (
    <div className="app-shell">
      <div className="ticker">
        <div className="ticker-info">
          <div className="ticker-date">
            {isToday ? dateLabel.toUpperCase() : `VIEWING ${dateLabel.toUpperCase()}`}
            {session.role === 'Admin' && <span className="admin-tag">ADMIN</span>}
          </div>
          <div className="ticker-greeting">
            {isToday ? <>Good {greetWord}, <span>{session.name}</span></> : <>{session.name}<span>'s day</span></>}
          </div>
        </div>
        <div className="ticker-right">
          <button className="icon-btn" title="Theme" onClick={cycleTheme}>{themeIcon}</button>
          <button className="icon-btn" title="Calendar" onClick={() => setCalendarOpen(true)}>📅</button>
          {isToday && totalCount > 0 && (
            <div className="ring-wrap">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle className="ring-track" cx="26" cy="26" r={R} />
                <circle className="ring-progress" cx="26" cy="26" r={R} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} />
              </svg>
              <span className="ring-label">{doneCount}/{totalCount}</span>
            </div>
          )}
          <button className="ticker-user" onClick={logout}>{session.name} ⏻</button>
        </div>
      </div>

      {!isToday && (
        <div className="date-nav">
          <button className="pill-btn" onClick={() => setViewedDate(todayKey())}>← Back to today</button>
        </div>
      )}

      {boardError && <div className="error-line">{boardError}</div>}
      {!boardError && tasks === null && (
        <div className="load-line">
          <span className="verifying-dot" /><span className="verifying-dot" /><span className="verifying-dot" />
          FETCHING TASKS…
        </div>
      )}
      {!boardError && tasks !== null && <TaskBoard tasks={tasks} onAction={handleAction} isFuture={!isToday && dateObj > new Date()} />}

      {isToday && (
        <div className="top-actions">
          <button className={`notif-btn${pushOn ? ' on' : ''}`} onClick={enablePush} disabled={pushOn}>
            {pushOn ? '● Notifications on' : 'Enable notifications'}
          </button>
        </div>
      )}

      {calendarOpen && (
        <Calendar selectedDate={viewedDate} onSelect={setViewedDate} onClose={() => setCalendarOpen(false)} />
      )}
    </div>
  )
}
