'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WrappedPayload } from '@/lib/stats'
import { buildCards, type CardDef } from './cards'
import { Summary } from './Summary'
import { ThemeToggle } from './ThemeToggle'

export function Story({ s, onYear, onDisconnect }: { s: WrappedPayload; onYear: (y: number) => void; onDisconnect: () => void }) {
  const cards: CardDef[] = useMemo(
    () => [
      ...buildCards(s),
      {
        id: 'summary',
        accent: 'var(--ink-2)',
        render: () => (
          <div className="card-inner enter" style={{ alignItems: 'center' }}>
            <Summary s={s} />
          </div>
        ),
      },
    ],
    [s],
  )
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [s.year, s.username])

  const go = useCallback((delta: number) => setIndex(i => Math.max(0, Math.min(cards.length - 1, i + delta))), [cards.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(cards.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, cards.length])

  // Tap the left third to go back, anywhere else to go forward (like stories apps).
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button, select, input, label')) return
    const x = e.clientX / window.innerWidth
    go(x < 0.33 ? -1 : 1)
  }

  // Basic horizontal swipe.
  const [touchX, setTouchX] = useState<number | null>(null)

  const card = cards[index]
  const years = s.availableYears.includes(s.year) ? s.availableYears : [s.year, ...s.availableYears].sort((a, b) => b - a)

  return (
    <div
      className="story"
      style={{ ['--accent' as string]: card.accent }}
      onClick={onTap}
      onTouchStart={e => setTouchX(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchX === null) return
        const dx = e.changedTouches[0].clientX - touchX
        setTouchX(null)
        if (Math.abs(dx) > 50) {
          e.preventDefault()
          go(dx < 0 ? 1 : -1)
        }
      }}
    >
      <section className="card" key={`${s.year}-${card.id}`} aria-roledescription="slide" aria-label={`${index + 1} of ${cards.length}`}>
        {card.render()}
      </section>

      <div className="chrome">
        <div className="progress" aria-hidden>
          {cards.map((c, i) => (
            <span key={c.id} className={i <= index ? 'done' : ''}>
              <i />
            </span>
          ))}
        </div>
        <div className="toolbar">
          <label onClick={e => e.stopPropagation()}>
            <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Year
            </span>
            <select className="select" value={s.year} onChange={e => onYear(Number(e.target.value))}>
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <div className="tools" onClick={e => e.stopPropagation()}>
            {s.sample ? <span className="label">Sample</span> : s.demo ? <span className="label">Allen&apos;s books</span> : null}
            <ThemeToggle />
            <button type="button" className="icon-btn" onClick={onDisconnect}>
              DISCONNECT
            </button>
          </div>
        </div>
      </div>

      <div className="hint label" aria-live="polite">
        {index + 1} / {cards.length}
        {index === 0 ? ' · tap, swipe or use arrow keys' : ''}
      </div>
    </div>
  )
}
