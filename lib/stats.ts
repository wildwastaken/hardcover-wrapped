// Turns a raw Hardcover `me { user_books { ... } }` response into one year's "wrapped" stats.
// Pure: no fetching and no Date.now() (pass `today` in), so it is tested against a saved fixture.
// Adapted from site/lib/books.ts.

export interface BookEntry {
  title: string
  author: string
  url: string
  cover: string
  color: string
  pages: number | null
  rating: number | null
  finishedOn: string // YYYY-MM-DD, the last finish inside the year
  timesThisYear: number
  reread: boolean // finished more than once this year, or also finished in an earlier year
}

export interface Count {
  name: string
  count: number
}

export interface Comparison {
  // e.g. { times: 3.2, label: 'The Lord of the Rings', pages: 1178 } -> "3.2x The Lord of the Rings"
  times: number
  label: string
  pages: number
}

export interface YearStats {
  year: number
  availableYears: number[]
  booksFinished: number // distinct books with a finish in the year
  readsFinished: number // every finish in the year, so a same-year reread counts twice
  rereads: number
  totalPages: number
  booksWithoutPages: number
  avgPages: number | null
  pagesPerDay: number | null
  daysPerBook: number | null
  comparison: Comparison | null
  avgRating: number | null
  ratedCount: number
  topAuthors: Count[]
  distinctAuthors: number
  topGenres: Count[]
  months: number[]
  busiestMonth: { index: number; count: number } | null
  longest: BookEntry | null
  shortest: BookEntry | null
  first: BookEntry | null
  last: BookEntry | null
  favorites: BookEntry[]
  favoritesAreFiveStar: boolean
  favoritesTotal: number
  books: BookEntry[]
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})/
const READ = 3 // Hardcover status_id for "Read"

// Hardcover dates are plain `date` strings; slicing avoids timezone shifts from new Date().
function day(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.match(DATE)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function positive(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

// Accepts the whole GraphQL body, its `data`, or the user_books array itself.
export function userBooksFrom(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  const data = raw?.data ?? raw
  const me = Array.isArray(data?.me) ? data.me[0] : data?.me
  return Array.isArray(me?.user_books) ? me.user_books : []
}

export function usernameFrom(raw: any): string {
  const data = raw?.data ?? raw
  const me = Array.isArray(data?.me) ? data.me[0] : data?.me
  return typeof me?.username === 'string' ? me.username : ''
}

function authorOf(book: any): string {
  const contributions = Array.isArray(book?.contributions) ? book.contributions : []
  // A null contribution role means the primary author; skip translators, illustrators, etc.
  const primary = contributions.find((c: any) => c?.author?.name && (!c.contribution || /^author$/i.test(c.contribution)))
  const any = contributions.find((c: any) => c?.author?.name)
  const name = (primary || any)?.author?.name
  if (name) return name
  const cached = book?.cached_contributors
  if (Array.isArray(cached)) return cached[0]?.author?.name || cached[0]?.name || ''
  return typeof cached === 'string' ? cached : ''
}

// cached_tags is untyped jsonb. Observed shape: { Genre: [{ tag: 'Fantasy', ... }], Mood: [...] }.
// Also tolerate a flat array of strings or { tag } objects.
export function genresOf(book: any): string[] {
  const tags = book?.cached_tags
  if (!tags || typeof tags !== 'object') return []
  const list = Array.isArray(tags) ? tags : tags.Genre ?? tags.genre ?? tags.Genres ?? tags.genres ?? []
  if (!Array.isArray(list)) return []
  const names = list
    .map((t: any) => (typeof t === 'string' ? t : t?.tag ?? t?.name))
    .filter((t: any): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t: string) => t.trim())
  return Array.from(new Set(names))
}

// Every finish date for a user_book, oldest first, duplicates kept (a reread on the same day is
// unlikely but still two reads). last_read_date stands in only for a "Read" book with no read rows,
// so a book currently being reread (status 2) never gets a made-up finish.
export function finishDates(userBook: any): string[] {
  const reads = Array.isArray(userBook?.user_book_reads) ? userBook.user_book_reads : []
  const dates = reads.map((r: any) => day(r?.finished_at)).filter(Boolean) as string[]
  const status = userBook?.status_id
  if (dates.length === 0 && (status === undefined || status === null || status === READ)) {
    const fallback = day(userBook?.last_read_date)
    if (fallback) dates.push(fallback)
  }
  return dates.sort()
}

function entry(userBook: any, finishedOn: string, timesThisYear: number, reread: boolean): BookEntry {
  const book = userBook?.book ?? {}
  const rating = positive(userBook?.rating)
  return {
    title: typeof book.title === 'string' && book.title.trim() ? book.title.trim() : 'Untitled',
    author: authorOf(book),
    url: book.slug ? `https://hardcover.app/books/${book.slug}` : '',
    cover: book.image?.url || userBook?.edition?.image?.url || '',
    color: typeof book.image?.color === 'string' ? book.image.color : '',
    pages: positive(userBook?.edition?.pages) ?? positive(book.pages),
    rating: rating === null ? null : Math.min(rating, 5),
    finishedOn,
    timesThisYear,
    reread,
  }
}

function tally(names: string[], limit: number): Count[] {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1)
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export function availableYears(raw: any): number[] {
  const years = new Set<number>()
  for (const ub of userBooksFrom(raw)) for (const d of finishDates(ub)) years.add(Number(d.slice(0, 4)))
  return Array.from(years).sort((a, b) => b - a)
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// Days of the year that have happened: the whole year for past years, up to `today` for this one.
function daysCovered(year: number, today?: string): number {
  const full = isLeap(year) ? 366 : 365
  const t = day(today)
  if (!t || Number(t.slice(0, 4)) !== year) return full
  const [, m, d] = t.split('-').map(Number)
  const cumulative = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  return Math.min(full, cumulative[m - 1] + d + (m > 2 && isLeap(year) ? 1 : 0))
}

// Well-known page counts (common editions, rounded). Kept to books, not "the height of a giraffe".
const YARDSTICKS: { label: string; pages: number }[] = [
  { label: 'In Search of Lost Time', pages: 4215 },
  { label: 'the whole Harry Potter series', pages: 4100 },
  { label: 'War and Peace', pages: 1225 },
  { label: 'The Lord of the Rings', pages: 1178 },
  { label: 'Moby-Dick', pages: 635 },
  { label: 'Pride and Prejudice', pages: 432 },
  { label: 'The Great Gatsby', pages: 180 },
]

// Picks the biggest yardstick the total clears at least once, so the multiplier reads naturally.
export function pageComparison(totalPages: number): Comparison | null {
  if (!(totalPages > 0)) return null
  const pick = YARDSTICKS.find(y => totalPages >= y.pages) ?? YARDSTICKS[YARDSTICKS.length - 1]
  return { times: Math.round((totalPages / pick.pages) * 10) / 10, label: pick.label, pages: pick.pages }
}

export function computeYearStats(raw: any, year: number, opts: { today?: string } = {}): YearStats {
  const prefix = `${year}-`
  const pairs: { ub: any; book: BookEntry }[] = []
  let readsFinished = 0
  for (const ub of userBooksFrom(raw)) {
    const all = finishDates(ub)
    const inYear = all.filter(d => d.startsWith(prefix))
    if (!inYear.length) continue
    readsFinished += inYear.length
    const earlier = all.some(d => d < prefix)
    // A book counts once per year, dated by its last finish that year.
    pairs.push({ ub, book: entry(ub, inYear[inYear.length - 1], inYear.length, earlier || inYear.length > 1) })
  }
  pairs.sort((a, b) => a.book.finishedOn.localeCompare(b.book.finishedOn) || a.book.title.localeCompare(b.book.title))
  const books = pairs.map(p => p.book)

  const months = new Array(12).fill(0)
  for (const b of books) months[Number(b.finishedOn.slice(5, 7)) - 1]++
  const peak = Math.max(0, ...months)
  const busiestMonth = peak > 0 ? { index: months.indexOf(peak), count: peak } : null

  const rated = books.filter(b => b.rating !== null)
  const avgRating = rated.length ? Math.round((rated.reduce((sum, b) => sum + (b.rating as number), 0) / rated.length) * 100) / 100 : null

  const withPages = books.filter(b => b.pages !== null)
  const byPages = [...withPages].sort((a, b) => (a.pages as number) - (b.pages as number) || a.title.localeCompare(b.title))
  const totalPages = withPages.reduce((sum, b) => sum + (b.pages as number), 0)

  const days = daysCovered(year, opts.today)
  const fiveStar = books.filter(b => b.rating !== null && b.rating >= 5)
  const topRating = rated.length ? Math.max(...rated.map(b => b.rating as number)) : null
  const favorites = fiveStar.length ? fiveStar : topRating !== null && topRating >= 4 ? rated.filter(b => b.rating === topRating) : []
  const authors = books.map(b => b.author).filter(Boolean)

  return {
    year,
    availableYears: availableYears(raw),
    booksFinished: books.length,
    readsFinished,
    rereads: books.filter(b => b.reread).length,
    totalPages,
    booksWithoutPages: books.length - withPages.length,
    avgPages: withPages.length ? Math.round(totalPages / withPages.length) : null,
    pagesPerDay: totalPages ? Math.round((totalPages / days) * 10) / 10 : null,
    daysPerBook: books.length ? Math.round((days / books.length) * 10) / 10 : null,
    comparison: pageComparison(totalPages),
    avgRating,
    ratedCount: rated.length,
    topAuthors: tally(authors, 5),
    distinctAuthors: new Set(authors).size,
    topGenres: tally(pairs.flatMap(p => genresOf(p.ub.book)), 5),
    months,
    busiestMonth,
    longest: byPages.length ? byPages[byPages.length - 1] : null,
    shortest: byPages.length > 1 ? byPages[0] : null,
    first: books[0] ?? null,
    last: books.length > 1 ? books[books.length - 1] : null,
    favorites: favorites.slice(0, 6),
    favoritesAreFiveStar: fiveStar.length > 0,
    favoritesTotal: favorites.length,
    books,
  }
}

// What the browser receives: the stats minus the full book list, plus a colour strip for the summary.
export type WrappedPayload = Omit<YearStats, 'books'> & {
  username: string
  spines: { color: string; title: string }[]
  sample?: boolean
  /** Allen's own shelf, shown when someone tries it without a token. */
  demo?: boolean
}

export function toPayload(raw: any, year: number | null, today: string): WrappedPayload {
  const years = availableYears(raw)
  const current = Number(today.slice(0, 4))
  const chosen = year ?? (years.includes(current) ? current : years[0] ?? current)
  const { books, ...stats } = computeYearStats(raw, chosen, { today })
  return {
    ...stats,
    username: usernameFrom(raw),
    spines: books.slice(0, 80).map(b => ({ color: b.color, title: b.title })),
  }
}

// Hardcover's account page shows the token as "Bearer eyJ...". Accept it with or without that.
export function normalizeToken(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/^bearer\s+/i, '').trim()
}
