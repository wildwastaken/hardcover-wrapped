'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WrappedPayload } from '@/lib/stats'
import { clearToken, loadToken, saveToken } from '@/lib/tokenStore'
import { Connect } from './Connect'
import { Story } from './Story'
import { ThemeToggle } from './ThemeToggle'

type ErrorCode = 'invalid_token' | 'rate_limited' | 'upstream' | 'network'

type State =
  | { kind: 'boot' }
  | { kind: 'connect'; error?: string }
  | { kind: 'loading'; year: number | null }
  | { kind: 'error'; code: ErrorCode; year: number | null }
  | { kind: 'ready'; data: WrappedPayload }

const INVALID = 'Hardcover didn’t accept that token. It may have expired or been reset — copy a fresh one from hardcover.app/account/api.'

export function App() {
  const [state, setState] = useState<State>({ kind: 'boot' })
  const token = useRef<string | null>(null)
  const request = useRef(0)

  const load = useCallback(async (year: number | null) => {
    const t = token.current
    if (!t) return setState({ kind: 'connect' })
    const id = ++request.current
    setState({ kind: 'loading', year })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/wrapped`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, year }),
        cache: 'no-store',
      })
      const body = await res.json().catch(() => null)
      if (id !== request.current) return
      if (res.ok && body && !body.error) return setState({ kind: 'ready', data: body })
      const code: ErrorCode = body?.error === 'invalid_token' || body?.error === 'rate_limited' ? body.error : 'upstream'
      if (code === 'invalid_token') {
        clearToken()
        token.current = null
        return setState({ kind: 'connect', error: INVALID })
      }
      setState({ kind: 'error', code, year })
    } catch {
      if (id === request.current) setState({ kind: 'error', code: 'network', year })
    }
  }, [])

  useEffect(() => {
    const saved = loadToken()
    if (saved) {
      token.current = saved.token
      load(null)
    } else setState({ kind: 'connect' })
  }, [load])

  const connect = (t: string, remember: boolean) => {
    token.current = t
    saveToken(t, remember)
    load(null)
  }

  const disconnect = () => {
    clearToken()
    token.current = null
    request.current++
    setState({ kind: 'connect' })
  }

  if (state.kind === 'boot') return <main className="page" />
  if (state.kind === 'connect') return <Connect onConnect={connect} error={state.error} />

  if (state.kind === 'loading') {
    return (
      <Shell onDisconnect={disconnect}>
        <p className="hero display pulse" style={{ fontSize: 'clamp(36px, 9vw, 56px)' }}>
          Pulling your shelves{state.year ? ` for ${state.year}` : ''}…
        </p>
        <p className="muted small">One read-only request to Hardcover.</p>
      </Shell>
    )
  }

  if (state.kind === 'error') {
    const message =
      state.code === 'rate_limited'
        ? 'Hardcover is asking us to slow down (it allows about 60 requests a minute). Give it a moment and try again.'
        : state.code === 'network'
          ? 'Couldn’t reach this site’s server. Check your connection and try again.'
          : 'Hardcover didn’t answer properly just now. It might be a hiccup on their end.'
    return (
      <Shell onDisconnect={disconnect}>
        <h1 className="hero display" style={{ fontSize: 'clamp(36px, 9vw, 56px)' }}>
          That didn&apos;t work.
        </h1>
        <p className="lede notice">{message}</p>
        <div className="row">
          <button className="btn" type="button" onClick={() => load(state.year)}>
            Try again
          </button>
        </div>
      </Shell>
    )
  }

  const data = state.data
  if (data.availableYears.length === 0) {
    return (
      <Shell onDisconnect={disconnect}>
        <h1 className="hero display" style={{ fontSize: 'clamp(40px, 10vw, 64px)' }}>
          A blank <em>first page</em>.
        </h1>
        <p className="lede">
          {data.username ? `@${data.username}` : 'Your account'} doesn&apos;t have any finished books on Hardcover yet. Mark a book as Read (with a finish
          date) and come back — your wrapped will be waiting.
        </p>
        <div className="row">
          <a className="btn" href="https://hardcover.app" target="_blank" rel="noopener noreferrer">
            Open Hardcover
          </a>
          <button className="btn ghost" type="button" onClick={() => load(null)}>
            Check again
          </button>
        </div>
      </Shell>
    )
  }

  if (data.booksFinished === 0) {
    return (
      <Shell onDisconnect={disconnect}>
        <h1 className="hero display" style={{ fontSize: 'clamp(40px, 10vw, 64px)' }}>
          Nothing finished in <em>{data.year}</em>.
        </h1>
        <p className="lede">No books on your Hardcover have a finish date in {data.year}. Pick a year that does:</p>
        <div className="row">
          {data.availableYears.map(y => (
            <button key={y} className="btn ghost" type="button" onClick={() => load(y)}>
              {y}
            </button>
          ))}
        </div>
      </Shell>
    )
  }

  return <Story s={data} onYear={y => load(y)} onDisconnect={disconnect} />
}

function Shell({ children, onDisconnect }: { children: React.ReactNode; onDisconnect: () => void }) {
  return (
    <main className="page">
      <div className="page-top">
        <span className="label">Hardcover Wrapped</span>
        <div className="row" style={{ gap: 14 }}>
          <ThemeToggle />
          <button type="button" className="icon-btn" onClick={onDisconnect}>
            DISCONNECT
          </button>
        </div>
      </div>
      <div className="page-main">{children}</div>
    </main>
  )
}
