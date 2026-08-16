const KEY = 'home-ops-theme' // 'auto' | 'day' | 'night'

export function getStoredPreference() {
  return localStorage.getItem(KEY) || 'auto'
}

export function setStoredPreference(pref) {
  localStorage.setItem(KEY, pref)
}

export function resolveTheme(pref) {
  if (pref === 'day' || pref === 'night') return pref
  const hour = new Date().getHours()
  return hour >= 6 && hour < 18 ? 'day' : 'night'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}
