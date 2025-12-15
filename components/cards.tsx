'use client'

import { useState, type ReactNode } from 'react'
import type { BookEntry, WrappedPayload } from '@/lib/stats'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const fmt = (n: number) => n.toLocaleString('en-US')
export const plural = (n: number, word: string, many = `${word}s`) => `${fmt(n)} ${n === 1 ? word : many}`
const longDate = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`
const stars = (r: number) => (Number.isInteger(r) ? `${r}` : r.toFixed(1))

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

export interface CardDef {
  id: string
  accent: string
  render: () => ReactNode
}

function Cover({ book, width }: { book: BookEntry; width: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="cover" style={{ width, backgroundColor: book.color || undefined }}>
      {book.cover && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} draggable={false} />
      ) : (
        <span className="ph" style={book.color ? undefined : { color: 'var(--ink)' }}>
          {book.title}
        </span>
      )}
    </div>
  )
}

function Title({ book, className = 'book-title' }: { book: BookEntry; className?: string }) {
  return book.url ? (
    <a className={className} href={book.url} target="_blank" rel="noopener noreferrer" onClick={stop}>
      {book.title}
    </a>
  ) : (
    <p className={className}>{book.title}</p>
  )
}

function BookRow({ caption, book, note, width = 92 }: { caption: string; book: BookEntry; note?: string; width?: number }) {
  return (
    <div className="book">
      <Cover book={book} width={width} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="kicker">{caption}</span>
        <Title book={book} />
        <span className="foot">{[book.author, note].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  )
}

function Inner({ children }: { children: ReactNode }) {
  return <div className="card-inner enter">{children}</div>
}

// Builds the deck for one year, skipping cards the data can't support.
export function buildCards(s: WrappedPayload): CardDef[] {
  const cards: CardDef[] = []
  const who = s.username ? `@${s.username}` : 'you'

  cards.push({
    id: 'intro',
    accent: 'var(--orange)',
    render: () => (
      <Inner>
        <span className="kicker">Hardcover Wrapped · {who}</span>
        <h1 className="big" style={{ fontSize: 'clamp(88px, 27vw, 176px)' }}>
          {s.year}
        </h1>
        <p className="headline">
          A year of <em>reading</em>, page by page.
        </p>
        <p className="foot">Tap or press → to begin.</p>
      </Inner>
    ),
  })

  cards.push({
    id: 'books',
    accent: 'var(--red)',
    render: () => (
      <Inner>
        <span className="kicker">Books finished</span>
        <p className="big">{fmt(s.booksFinished)}</p>
        <p className="headline">
          {s.booksFinished === 1 ? 'book' : 'books'}, start to finish{s.daysPerBook && s.booksFinished > 1 ? <>, about <em>one every {Math.round(s.daysPerBook)} days</em></> : null}.
        </p>
        {s.rereads > 0 ? (
          <p className="body">
            {plural(s.rereads, 'was a reread', 'were rereads').replace(/^(\d+)/, '$1 of them')}
            {s.readsFinished > s.booksFinished ? `, for ${fmt(s.readsFinished)} finishes in all` : ''}.
          </p>
        ) : null}
        <p className="foot">{s.distinctAuthors ? `By ${plural(s.distinctAuthors, 'different author')}.` : null}</p>
      </Inner>
    ),
  })

  if (s.totalPages > 0) {
    const c = s.comparison
    cards.push({
      id: 'pages',
      accent: 'var(--yellow)',
      render: () => (
        <Inner>
          <span className="kicker">Pages turned</span>
          <p className="big mid">{fmt(s.totalPages)}</p>
          {c ? (
            <p className="headline">
              {c.times >= 1 ? (
                <>
                  That&apos;s <em>{c.times === 1 ? 'about' : `${c.times}×`}</em> {c.label}.
                </>
              ) : (
                <>
                  About <em>{Math.round(c.times * 100)}%</em> of {c.label}.
                </>
              )}
            </p>
          ) : null}
          <p className="body">
            {s.pagesPerDay ? `${s.pagesPerDay >= 10 ? Math.round(s.pagesPerDay) : s.pagesPerDay} pages a day` : null}
            {s.avgPages ? `${s.pagesPerDay ? ', ' : ''}${fmt(s.avgPages)} per book on average` : null}.
          </p>
          {s.booksWithoutPages ? <p className="foot">{plural(s.booksWithoutPages, 'book has', 'books have')} no page count on Hardcover and isn&apos;t included.</p> : null}
        </Inner>
      ),
    })
  }

  if (s.busiestMonth && s.booksFinished > 1) {
    const peak = s.busiestMonth
    const tied = s.months.filter(n => n === peak.count).length
    const max = peak.count
    cards.push({
      id: 'months',
      accent: 'var(--green)',
      render: () => (
        <Inner>
          <span className="kicker">Busiest month</span>
          <p className="headline" style={{ fontSize: 'clamp(48px, 14vw, 84px)' }}>
            <em>{MONTHS[peak.index]}</em>
          </p>
          <p className="body">
            {plural(peak.count, 'book')} finished{tied > 1 ? `, tied with ${tied - 1} other ${tied - 1 === 1 ? 'month' : 'months'}` : ''}.
          </p>
          <div className="months" role="img" aria-label={s.months.map((n, i) => `${MONTHS[i]}: ${n}`).join(', ')}>
            {s.months.map((n, i) => (
              <div className="m" key={i}>
                <span className="n">{n || ''}</span>
                <div className={`bar${n === max ? ' peak' : ''}`} style={{ height: n ? `${Math.max(6, (n / max) * 100)}%` : 2 }} />
                <span className="n">{MONTHS[i][0]}</span>
              </div>
            ))}
          </div>
        </Inner>
      ),
    })
  }

  const topAuthor = s.topAuthors[0]
  if (topAuthor) {
    const repeat = topAuthor.count > 1
    cards.push({
      id: 'author',
      accent: 'var(--blue)',
      render: () => (
        <Inner>
          <span className="kicker">{repeat ? 'Most-read author' : 'Authors'}</span>
          {repeat ? (
            <>
              <p className="headline" style={{ fontSize: 'clamp(40px, 11vw, 68px)' }}>
                <em>{topAuthor.name}</em>
              </p>
              <p className="body">{plural(topAuthor.count, 'book')} this year. Some writers you just keep going back to.</p>
            </>
          ) : (
            <>
              <p className="big mid">{fmt(s.distinctAuthors)}</p>
              <p className="headline">
                different authors, <em>no repeats</em>.
              </p>
            </>
          )}
          {s.topAuthors.length > 1 && repeat ? (
            <ol className="ranked">
              {s.topAuthors.slice(1, 5).map((a, i) => (
                <li key={a.name}>
                  <span className="label">{i + 2}</span>
                  <span className="name">{a.name}</span>
                  <span className="label">{a.count}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </Inner>
      ),
    })
  }

  const topGenre = s.topGenres[0]
  if (topGenre) {
    cards.push({
      id: 'genre',
      accent: 'var(--purple)',
      render: () => (
        <Inner>
          <span className="kicker">Top genre</span>
          <p className="headline" style={{ fontSize: 'clamp(44px, 12vw, 76px)' }}>
            <em>{topGenre.name}</em>
          </p>
          <p className="body">
            Tagged on {plural(topGenre.count, 'book')} of your {fmt(s.booksFinished)}.
          </p>
          {s.topGenres.length > 1 ? (
            <ol className="ranked">
              {s.topGenres.slice(1, 5).map((g, i) => (
                <li key={g.name}>
                  <span className="label">{i + 2}</span>
                  <span className="name">{g.name}</span>
                  <span className="label">{g.count}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </Inner>
      ),
    })
  }

  if (s.longest) {
    const { longest, shortest } = s
    cards.push({
      id: 'lengths',
      accent: 'var(--cyan)',
      render: () => (
        <Inner>
          <span className="kicker">{shortest ? 'Longest and shortest' : 'Longest book'}</span>
          <p className="headline">
            {shortest ? (
              <>
                From <em>{fmt(shortest.pages ?? 0)}</em> pages to <em>{fmt(longest.pages ?? 0)}</em>.
              </>
            ) : (
              <>
                <em>{fmt(longest.pages ?? 0)}</em> pages.
              </>
            )}
          </p>
          <div className="pair">
            <BookRow caption="Longest" book={longest} note={`${fmt(longest.pages ?? 0)} pages`} />
            {shortest ? <BookRow caption="Shortest" book={shortest} note={`${fmt(shortest.pages ?? 0)} pages`} /> : null}
          </div>
        </Inner>
      ),
    })
  }

  if (s.favorites.length) {
    const favs = s.favorites
    cards.push({
      id: 'favorites',
      accent: 'var(--magenta)',
      render: () => (
        <Inner>
          <span className="kicker">{s.favoritesAreFiveStar ? 'Five stars' : 'Your highest rated'}</span>
          <p className="headline">
            {s.favoritesAreFiveStar ? (
              favs.length === 1 ? (
                <>
                  <em>One</em> book got full marks.
                </>
              ) : (
                <>
                  <em>{s.favoritesTotal}</em> books got full marks.
                </>
              )
            ) : (
              <>
                Nothing got five stars, but these got <em>{stars(favs[0].rating ?? 0)}</em>.
              </>
            )}
          </p>
          <div className="favs" style={{ ['--cols' as string]: Math.min(3, favs.length), ['--rows' as string]: Math.ceil(favs.length / 3) }}>
            {favs.map(b => (
              <figure key={b.title + b.finishedOn}>
                <div style={{ width: '100%' }}>
                  <CoverFill book={b} />
                </div>
                <figcaption>
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noopener noreferrer" onClick={stop} style={{ textDecoration: 'none' }}>
                      {b.title}
                    </a>
                  ) : (
                    b.title
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
          {s.avgRating !== null ? <p className="foot">Average rating {s.avgRating.toFixed(2)} across {plural(s.ratedCount, 'rated book')}.</p> : null}
        </Inner>
      ),
    })
  }

  if (s.first) {
    const { first, last } = s
    cards.push({
      id: 'bookends',
      accent: 'var(--orange)',
      render: () => (
        <Inner>
          <span className="kicker">{last ? 'Bookends' : 'Your one book'}</span>
          <p className="headline">{last ? <>How the year <em>opened</em> and <em>closed</em>.</> : <>Just the one, and it counts.</>}</p>
          <div className="pair">
            <BookRow caption={`First · ${longDate(first.finishedOn)}`} book={first} />
            {last ? <BookRow caption={`Latest · ${longDate(last.finishedOn)}`} book={last} /> : null}
          </div>
        </Inner>
      ),
    })
  }

  return cards
}

function CoverFill({ book }: { book: BookEntry }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="cover" style={{ width: '100%', backgroundColor: book.color || undefined }}>
      {book.cover && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover} alt={`Cover of ${book.title}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} draggable={false} />
      ) : (
        <span className="ph" style={book.color ? undefined : { color: 'var(--ink)' }}>
          {book.title}
        </span>
      )}
    </div>
  )
}
