'use client'

import { useEffect, useState } from 'react'
import { DEV_TOKEN_PLACEHOLDER, SAMPLE_TOKEN } from '@/lib/devToken'
import { normalizeToken } from '@/lib/stats'
import { ThemeToggle } from './ThemeToggle'

export function Connect({ onConnect, error }: { onConnect: (token: string, remember: boolean) => void; error?: string }) {
  const [value, setValue] = useState('')
  const [remember, setRemember] = useState(false)
  const [devAvailable, setDevAvailable] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/dev-token`)
      .then(r => r.json())
      .then(d => setDevAvailable(Boolean(d?.available)))
      .catch(() => {})
  }, [])

  const token = normalizeToken(value)

  return (
    <main className="page">
      <div className="page-top">
        <span className="label">Hardcover Wrapped</span>
        <ThemeToggle />
      </div>
      <div className="page-main">
        <h1 className="hero display">
          Your year
          <br />
          in <em>books</em>.
        </h1>
        <p className="lede">
          Paste your Hardcover API token (it&apos;s at{' '}
          <a href="https://hardcover.app/account/api" target="_blank" rel="noopener noreferrer">
            hardcover.app/account/api
          </a>
          ) and get your reading year back as a story you can share. No token? Try it with my books.
        </p>

        <form
          className="field"
          onSubmit={e => {
            e.preventDefault()
            if (token) onConnect(token, remember)
          }}
        >
          <label className="label" htmlFor="token">
            API token
          </label>
          <input
            id="token"
            className="input"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Bearer eyJhbGciOi…"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>
              Remember on this device
              <span className="muted small" style={{ display: 'block' }}>
                Otherwise it&apos;s forgotten when you close this tab.
              </span>
            </span>
          </label>
          {error ? (
            <p className="notice small" role="alert">
              {error}
            </p>
          ) : null}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn" type="submit" disabled={!token}>
              Make my wrapped
            </button>
            <button type="button" className="link-btn muted" onClick={() => onConnect(SAMPLE_TOKEN, false)}>
              or try it with mine
            </button>
          </div>
          {devAvailable ? (
            <button type="button" className="link-btn muted small" style={{ alignSelf: 'flex-start' }} onClick={() => onConnect(DEV_TOKEN_PLACEHOLDER, false)}>
              Dev only: use HARDCOVER_DEV_TOKEN from .env.local
            </button>
          ) : null}
        </form>

        <p className="muted small">
          Your token stays in this browser. It&apos;s sent to this site&apos;s server only to ask Hardcover for your reading log (read-only), and is never
          logged or saved there. Nothing about your books is stored. You can disconnect at any time.
        </p>
      </div>
    </main>
  )
}
