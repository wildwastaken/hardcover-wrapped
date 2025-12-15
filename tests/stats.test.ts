import { describe, expect, it } from 'vitest'
import fixture from './fixtures/hardcover-read-books.json'
import {
  availableYears,
  computeYearStats,
  finishDates,
  genresOf,
  normalizeToken,
  pageComparison,
  toPayload,
  userBooksFrom,
  usernameFrom,
} from '@/lib/stats'

const wrap = (user_books: any[], username = 'reader') => ({ data: { me: [{ username, user_books }] } })
const book = (title: string, extra: any = {}) => ({ title, slug: title.toLowerCase().replace(/\W+/g, '-'), pages: 200, ...extra })

describe('input shapes', () => {
  it('accepts the GraphQL body, data, or the bare array', () => {
    expect(userBooksFrom(fixture)).toHaveLength(19)
    expect(userBooksFrom(fixture.data)).toHaveLength(19)
    expect(userBooksFrom(fixture.data.me[0].user_books)).toHaveLength(19)
    expect(userBooksFrom({ data: { me: [] } })).toHaveLength(0)
    expect(userBooksFrom(null)).toHaveLength(0)
    expect(usernameFrom(wrap([], 'allen'))).toBe('allen')
    expect(usernameFrom(null)).toBe('')
  })

  it('lists years with finished reads, newest first', () => {
    expect(availableYears(fixture)).toEqual([2026, 2025, 2024])
  })
})

describe('a full year from the fixture', () => {
  const s = computeYearStats(fixture, 2026, { today: '2026-12-31' })

  it('counts books, pages and ratings', () => {
    expect(s.booksFinished).toBe(13)
    expect(s.readsFinished).toBe(13)
    expect(s.totalPages).toBe(5090)
    expect(s.booksWithoutPages).toBe(0)
    expect(s.avgPages).toBe(392)
    expect(s.ratedCount).toBe(12)
    expect(s.avgRating).toBe(4.33)
  })

  it('builds the month chart and busiest month', () => {
    expect(s.months).toEqual([2, 1, 1, 1, 1, 2, 1, 2, 0, 1, 1, 0])
    expect(s.months.reduce((a, b) => a + b, 0)).toBe(s.booksFinished)
    expect(s.busiestMonth).toEqual({ index: 0, count: 2 }) // ties go to the earliest month
  })

  it('credits authors, not translators', () => {
    expect(s.topAuthors[0]).toEqual({ name: 'Kazuo Ishiguro', count: 3 })
    expect(s.topAuthors.some(a => a.name === 'Richard Pevear' || a.name === 'Gregory Hays')).toBe(false)
    expect(s.distinctAuthors).toBeGreaterThan(5)
  })

  it('takes genres only from the Genre category', () => {
    expect(s.topGenres[0]).toEqual({ name: 'Fiction', count: 8 })
    expect(s.topGenres.some(g => g.name === 'reflective')).toBe(false)
  })

  it('finds longest, shortest, first, last and favourites', () => {
    expect(s.longest?.title).toBe('The Brothers Karamazov')
    expect(s.longest?.pages).toBe(796)
    expect(s.shortest?.title).toBe('The Old Man and the Sea')
    expect(s.first?.title).toBe('Piranesi')
    expect(s.first?.finishedOn).toBe('2026-01-09')
    expect(s.first?.url).toBe('https://hardcover.app/books/piranesi')
    expect(s.first?.cover).toMatch(/^https:\/\//)
    expect(s.last?.title).toBe('Tomorrow, and Tomorrow, and Tomorrow')
    expect(s.last?.rating).toBe(4) // string ratings are coerced
    expect(s.favoritesAreFiveStar).toBe(true)
    expect(s.favorites.map(b => b.title)).toEqual(['Piranesi', 'The Brothers Karamazov', 'Meditations', 'The Dispossessed'])
  })

  it('paces and compares', () => {
    expect(s.pagesPerDay).toBe(13.9) // 5090 / 365
    expect(s.daysPerBook).toBe(28.1)
    expect(s.comparison).toEqual({ times: 1.2, label: 'In Search of Lost Time', pages: 4215 })
  })

  it('uses days so far for the current year', () => {
    const partial = computeYearStats(fixture, 2026, { today: '2026-03-01' })
    expect(partial.pagesPerDay).toBe(Math.round((5090 / 60) * 10) / 10)
  })
})

describe('small and empty years', () => {
  it('a single book is first but not also last or shortest', () => {
    const one = computeYearStats(fixture, 2024)
    expect(one.booksFinished).toBe(1)
    expect(one.longest?.title).toBe('The Hobbit')
    expect(one.shortest).toBeNull()
    expect(one.first?.title).toBe('The Hobbit')
    expect(one.last).toBeNull()
  })

  it('a year with nothing finished is all zeros and nulls', () => {
    const empty = computeYearStats(fixture, 1999)
    expect(empty.booksFinished).toBe(0)
    expect(empty.readsFinished).toBe(0)
    expect(empty.totalPages).toBe(0)
    expect(empty.avgRating).toBeNull()
    expect(empty.avgPages).toBeNull()
    expect(empty.pagesPerDay).toBeNull()
    expect(empty.comparison).toBeNull()
    expect(empty.busiestMonth).toBeNull()
    expect(empty.longest).toBeNull()
    expect(empty.first).toBeNull()
    expect(empty.favorites).toEqual([])
    expect(empty.months).toEqual(new Array(12).fill(0))
    expect(empty.availableYears).toEqual([2026, 2025, 2024])
  })

  it('an account with no books at all', () => {
    const none = toPayload(wrap([]), null, '2026-11-16')
    expect(none.year).toBe(2026)
    expect(none.availableYears).toEqual([])
    expect(none.booksFinished).toBe(0)
    expect(none.spines).toEqual([])
  })

  it('missing optional fields do not throw', () => {
    const bare = computeYearStats(wrap([{ user_book_reads: [{ finished_at: '2026-03-01' }], book: {} }]), 2026)
    expect(bare.booksFinished).toBe(1)
    expect(bare.books[0].title).toBe('Untitled')
    expect(bare.totalPages).toBe(0)
    expect(bare.booksWithoutPages).toBe(1)
    expect(bare.topAuthors).toEqual([])
    expect(bare.comparison).toBeNull()
  })
})

describe('multiple reads', () => {
  const raw = wrap([
    // Read twice in 2025 and once more in 2026.
    {
      status_id: 3,
      rating: 5,
      user_book_reads: [{ finished_at: '2025-02-10' }, { finished_at: '2025-09-01' }, { finished_at: '2026-04-04' }],
      book: book('Circe'),
    },
    { status_id: 3, user_book_reads: [{ finished_at: '2025-05-05' }], book: book('Dune', { pages: 600 }) },
    // Being reread now (status 2): the earlier finish counts, no fallback date is invented.
    { status_id: 2, last_read_date: '2026-10-01', user_book_reads: [{ finished_at: '2024-08-08' }, { finished_at: null }], book: book('Emma') },
    // "Read" with no read rows: last_read_date stands in.
    { status_id: 3, last_read_date: '2026-06-06', user_book_reads: [], book: book('Beloved') },
    // Want to read, nothing finished: ignored.
    { status_id: 1, last_read_date: '2026-01-01', user_book_reads: [], book: book('Ulysses') },
  ])

  it('counts a same-year reread once as a book but twice as a read', () => {
    const y = computeYearStats(raw, 2025)
    expect(y.booksFinished).toBe(2)
    expect(y.readsFinished).toBe(3)
    expect(y.rereads).toBe(1)
    const circe = y.books.find(b => b.title === 'Circe')!
    expect(circe.finishedOn).toBe('2025-09-01') // dated by the last finish that year
    expect(circe.timesThisYear).toBe(2)
    expect(y.months[8]).toBe(1)
    expect(y.months[1]).toBe(0)
    expect(y.totalPages).toBe(800) // pages counted once per book
  })

  it('a book finished again in a later year shows up there as a reread', () => {
    const y = computeYearStats(raw, 2026)
    expect(y.books.map(b => b.title)).toEqual(['Circe', 'Beloved'])
    expect(y.books[0].reread).toBe(true)
    expect(y.books[0].timesThisYear).toBe(1)
    expect(y.books[1].reread).toBe(false)
    expect(y.rereads).toBe(1)
  })

  it('does not invent finish dates for unfinished statuses', () => {
    expect(finishDates({ status_id: 2, last_read_date: '2026-10-01', user_book_reads: [] })).toEqual([])
    expect(finishDates({ status_id: 1, last_read_date: '2026-10-01' })).toEqual([])
    expect(finishDates({ status_id: 3, last_read_date: '2026-10-01T12:00:00Z' })).toEqual(['2026-10-01'])
    expect(availableYears(raw)).toEqual([2026, 2025, 2024])
  })

  it('falls back to the highest rating when nothing got five stars', () => {
    const y = computeYearStats(
      wrap([
        { rating: 4.5, user_book_reads: [{ finished_at: '2023-01-01' }], book: book('A') },
        { rating: 4.5, user_book_reads: [{ finished_at: '2023-02-01' }], book: book('B') },
        { rating: 3, user_book_reads: [{ finished_at: '2023-03-01' }], book: book('C') },
      ]),
      2023,
    )
    expect(y.favoritesAreFiveStar).toBe(false)
    expect(y.favorites.map(b => b.title)).toEqual(['A', 'B'])
  })
})

describe('helpers', () => {
  it('genres tolerate flat lists and nulls', () => {
    expect(genresOf({ cached_tags: ['Poetry', { tag: 'Essays' }, '', null] })).toEqual(['Poetry', 'Essays'])
    expect(genresOf({ cached_tags: null })).toEqual([])
  })

  it('page comparisons pick the biggest yardstick cleared', () => {
    expect(pageComparison(0)).toBeNull()
    expect(pageComparison(90)).toEqual({ times: 0.5, label: 'The Great Gatsby', pages: 180 })
    expect(pageComparison(2356)?.label).toBe('War and Peace')
    expect(pageComparison(1200)?.label).toBe('The Lord of the Rings')
    expect(pageComparison(12000)?.label).toBe('In Search of Lost Time')
  })

  it('strips a Bearer prefix and whitespace from tokens', () => {
    expect(normalizeToken('  Bearer abc.def  ')).toBe('abc.def')
    expect(normalizeToken('bearer   abc')).toBe('abc')
    expect(normalizeToken('abc')).toBe('abc')
    expect(normalizeToken(undefined)).toBe('')
  })

  it('the payload drops the book list and picks a sensible default year', () => {
    const p = toPayload(fixture, null, '2027-01-03')
    expect(p.year).toBe(2026) // nothing yet in 2027, so the latest year with books
    expect('books' in p).toBe(false)
    expect(p.spines).toHaveLength(13)
    expect(toPayload(fixture, 2025, '2026-11-16').booksFinished).toBe(5)
  })
})
