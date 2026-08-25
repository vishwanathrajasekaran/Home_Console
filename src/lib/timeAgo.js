export function timeAgo(isoString) {
  if (!isoString) return null
  const then = new Date(isoString).getTime()
  const now = Date.now()
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function minutesSince(isoString) {
  if (!isoString) return Infinity
  return (Date.now() - new Date(isoString).getTime()) / 60000
}
