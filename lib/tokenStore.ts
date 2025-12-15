// The token lives only in this browser: sessionStorage by default (gone when the tab closes),
// localStorage when the reader ticks "remember on this device". Storage can throw (private
// windows, blocked site data), so every access is guarded and the app still works in memory.
const KEY = 'hcw.token'

export function loadToken(): { token: string; remembered: boolean } | null {
  try {
    const local = window.localStorage.getItem(KEY)
    if (local) return { token: local, remembered: true }
  } catch {}
  try {
    const session = window.sessionStorage.getItem(KEY)
    if (session) return { token: session, remembered: false }
  } catch {}
  return null
}

export function saveToken(token: string, remember: boolean) {
  clearToken()
  try {
    ;(remember ? window.localStorage : window.sessionStorage).setItem(KEY, token)
  } catch {}
}

export function clearToken() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {}
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {}
}
