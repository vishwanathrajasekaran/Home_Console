import { useEffect, useState, useCallback } from 'react'
import PinLogin from './components/PinLogin.jsx'
import TaskBoard from './components/TaskBoard.jsx'
import RemarkModal from './components/RemarkModal.jsx'
import { api } from './lib/api.js'
import { isSubscribed, subscribeToPush } from './lib/push.js'

const SESSION_KEY = 'home-ops-session'

export default function App() {
  const [users, setUsers] = useState(null)
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })
  const [loginError, setLoginError] = useState(null)
  const [loginBusy, setLoginBusy] = useState(false)

  const [tasks, setTasks] = useState(null)
  const [boardError, setBoardError] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // { task, status }
  const [pushOn, setPushOn] = useState(false)

  useEffect(() => {
    api.getUsers().then((d) => setUsers(d.users)).catch((e) => setBoardError(e.message))
  }, [])

  const refreshToday = useCallback(() => {
    if (!session) return
    api.getToday(session.userId)
      .then((d) => setTasks(d.tasks))
      .catch((e) => setBoardError(e.message))
  }, [session])

  useEffect(() => { refreshToday() }, [refreshToday])

  useEffect(() => {
    if (session) isSubscribed().then(setPushOn)
  }, [session])

  function handleLogin(userId, pin, onFail) {
    setLoginBusy(true)
    setLoginError(null)
    api.login(userId, pin)
      .then((d) => {
        if (!d.ok) throw new Error('Wrong PIN')
        const s = { userId, name: d.name }
        localStorage.setItem(SESSION_KEY, JSON.stringify(s))
        setSession(s)
      })
      .catch((e) => { setLoginError(e.message); onFail() })
      .finally(() => setLoginBusy(false))
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setTasks(null)
  }

  function handleAction(task, status) {
    if (status === 'DONE') {
      applyUpdate(task, status, '')
    } else {
      setPendingAction({ task, status })
    }
  }

  function applyUpdate(task, status, remark) {
    setTasks((prev) => prev.map((t) => t.occurrenceId === task.occurrenceId ? { ...t, status } : t))
    setPendingAction(null)
    api.updateOccurrence({ occurrenceId: task.occurrenceId, status, remark, userId: session.userId })
      .catch(() => refreshToday())
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

  if (!users) return <div className="load-line">LOADING HOME CONSOLE…</div>

  if (!session) {
    return <PinLogin users={users} onLogin={handleLogin} error={loginError} busy={loginBusy} />
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
  const hour = new Date().getHours()
  const greetWord = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

  const doneCount = (tasks || []).filter((t) => t.status === 'DONE').length
  const totalCount = (tasks || []).length
  const pct = totalCount > 0 ? doneCount / totalCount : 0
  const R = 22
  const circumference = 2 * Math.PI * R

  return (
    <div className="app-shell">
      <div className="ticker">
        <div className="ticker-info">
          <div className="ticker-date">{today.toUpperCase()}</div>
          <div className="ticker-greeting">Good {greetWord}, <span>{session.name}</span></div>
        </div>
        <div className="ticker-right">
          {totalCount > 0 && (
            <div className="ring-wrap">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle className="ring-track" cx="26" cy="26" r={R} />
                <circle
                  className="ring-progress"
                  cx="26" cy="26" r={R}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - pct)}
                />
              </svg>
              <span className="ring-label">{doneCount}/{totalCount}</span>
            </div>
          )}
          <button className="ticker-user" onClick={logout}>{session.name} ⏻</button>
        </div>
      </div>

      {boardError && <div className="error-line">{boardError}</div>}
      {!boardError && tasks === null && <div className="load-line">FETCHING TODAY'S TASKS…</div>}
      {!boardError && tasks !== null && <TaskBoard tasks={tasks} onAction={handleAction} />}

      <div className="top-actions">
        <button className={`notif-btn${pushOn ? ' on' : ''}`} onClick={enablePush} disabled={pushOn}>
          {pushOn ? '● Notifications on' : 'Enable notifications'}
        </button>
      </div>

      {pendingAction && (
        <RemarkModal
          task={pendingAction.task}
          status={pendingAction.status}
          onCancel={() => setPendingAction(null)}
          onConfirm={(remark) => applyUpdate(pendingAction.task, pendingAction.status, remark)}
        />
      )}
    </div>
  )
}
