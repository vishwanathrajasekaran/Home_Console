const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL

function buildUrl(params) {
  const url = new URL(BASE_URL)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })
  return url.toString()
}

async function call(params) {
  if (!BASE_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL is not set. Add it as a Vercel env var.')
  }
  const res = await fetch(buildUrl(params), { method: 'GET' })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export const api = {
  getUsers: () => call({ action: 'getUsers' }),
  login: (userId, pin) => call({ action: 'login', userId, pin }),
  getToday: (userId) => call({ action: 'getToday', userId }),
  getForDate: (userId, date) => call({ action: 'getForDate', userId, date }),
  getStats: (userId, days) => call({ action: 'getStats', userId, days }),
  getWaterTank: (tank) => call({ action: 'getWaterTank', tank: tank || '1' }),
  updateOccurrence: ({ occurrenceId, status, remark, userId, snoozeUntil }) =>
    call({ action: 'updateOccurrence', occurrenceId, status, remark: remark || '', userId, snoozeUntil: snoozeUntil || '' }),
  saveSubscription: (userId, subscription) =>
    call({ action: 'subscribe', userId, sub: JSON.stringify(subscription) }),
}
