'use client'

import { useRef, useState } from 'react'
import type { WrappedPayload } from '@/lib/stats'
import { MONTHS, fmt } from './cards'

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

// Fallback spine colours when Hardcover has no cover colour for a book.
const SPINE_FALLBACK = ['var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--green)', 'var(--cyan)', 'var(--blue)', 'var(--purple)', 'var(--magenta)']

export function Summary({ s }: { s: WrappedPayload }) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

  const fileName = `hardcover-wrapped-${s.year}.png`

  async function render(): Promise<string> {
    const node = ref.current
    if (!node) throw new Error('missing card')
    const { toPng } = await import('html-to-image')
    const bg = getComputedStyle(node).backgroundColor
    // Draw at a fixed 1080px width so the image is the same on every screen.
    const scale = 1080 / node.offsetWidth
    return toPng(node, { pixelRatio: scale, backgroundColor: bg, cacheBust: true, style: { borderRadius: '0', boxShadow: 'none' } })
  }

  async function download(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    setError('')
    try {
      const url = await render()
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
    } catch {
      setError('Could not draw the image in this browser. A screenshot works too.')
    } finally {
      setBusy(false)
    }
  }

  async function share(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    setError('')
    try {
      const blob = await (await fetch(await render())).blob()
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `My ${s.year} in books` })
      else setError('Sharing images is not supported here. Use Download instead.')
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError('Could not share the image. Try Download instead.')
    } finally {
      setBusy(false)
    }
  }

  const favorite = s.favorites[0]
  const items: { k: string; v: string; num?: boolean }[] = [
    { k: 'Books', v: fmt(s.booksFinished), num: true },
    { k: 'Pages', v: s.totalPages ? fmt(s.totalPages) : '—', num: true },
    { k: s.topAuthors[0]?.count > 1 ? 'Top author' : 'Authors', v: s.topAuthors[0]?.count > 1 ? s.topAuthors[0].name : `${s.distinctAuthors} different` },
    { k: 'Top genre', v: s.topGenres[0]?.name ?? '—' },
    { k: 'Busiest month', v: s.busiestMonth ? MONTHS[s.busiestMonth.index] : '—' },
    { k: s.favoritesAreFiveStar ? 'A five-star read' : 'Highest rated', v: favorite?.title ?? s.longest?.title ?? '—' },
  ]

  return (
    <div className="summary-wrap">
      <div className="share" ref={ref}>
        <span className="s-k">{s.username ? `@${s.username}` : 'Hardcover'}</span>
        <p className="s-title">
          My {s.year}
          <br />
          in <em>books</em>
        </p>
        <div className="s-grid">
          {items.map(item => (
            <div key={item.k}>
              <div className="s-k">{item.k}</div>
              <div className={`s-v${item.num ? ' num' : ''}`}>{item.v}</div>
            </div>
          ))}
        </div>
        <div className="spines" aria-hidden>
          {s.spines.slice(0, 40).map((b, i) => (
            <i key={i} style={{ background: b.color || SPINE_FALLBACK[i % SPINE_FALLBACK.length], height: `${62 + ((i * 37) % 38)}%` }} />
          ))}
        </div>
        <div className="s-foot">
          <span>Hardcover Wrapped</span>
          <span>{s.sample ? 'Sample data' : s.demo ? 'allenliu.dev/wrapped' : 'hardcover.app'}</span>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'center' }} onClick={stop}>
        <button className="btn" type="button" onClick={download} disabled={busy}>
          {busy ? 'Drawing…' : 'Download image'}
        </button>
        {canShare ? (
          <button className="btn ghost" type="button" onClick={share} disabled={busy}>
            Share
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="foot" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
