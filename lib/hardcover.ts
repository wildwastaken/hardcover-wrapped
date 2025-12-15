import { createHash } from 'node:crypto'

// Read-only. This file must never send a mutation.
const ENDPOINT = 'https://api.hardcover.app/v1/graphql'

// "Read" books plus anything with a finished read (e.g. a book being reread right now).
const QUERY = `
  query Wrapped {
    me {
      username
      user_books(
        where: { _or: [{ status_id: { _eq: 3 } }, { user_book_reads: { finished_at: { _is_null: false } } }] }
        order_by: { last_read_date: desc_nulls_last }
      ) {
        status_id
        rating
        last_read_date
        user_book_reads(order_by: { finished_at: asc_nulls_last }) {
          finished_at
        }
        edition {
          pages
          image {
            url
          }
        }
        book {
          title
          slug
          pages
          cached_tags
          image {
            url
            color
          }
          contributions {
            contribution
            author {
              name
            }
          }
        }
      }
    }
  }
`

export type FetchError = 'invalid_token' | 'rate_limited' | 'upstream'

export class HardcoverError extends Error {
  constructor(public code: FetchError, public status?: number) {
    super(code)
  }
}

// Short in-memory cache so stepping between years does not re-query Hardcover.
// Keyed by a hash of the token; the token itself is never stored or logged.
const TTL_MS = 2 * 60 * 1000
const MAX_ENTRIES = 200
const cache = new Map<string, { at: number; body: unknown }>()

const keyFor = (token: string) => createHash('sha256').update(token).digest('hex')

export function forget(token: string) {
  cache.delete(keyFor(token))
}

export async function fetchReadBooks(token: string): Promise<unknown> {
  const key = keyFor(token)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: QUERY }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new HardcoverError('upstream')
  }

  if (response.status === 401 || response.status === 403) throw new HardcoverError('invalid_token', response.status)
  if (response.status === 429) throw new HardcoverError('rate_limited', 429)
  if (!response.ok) throw new HardcoverError('upstream', response.status)

  const body: any = await response.json().catch(() => null)
  if (!body) throw new HardcoverError('upstream')
  if (body.errors) {
    const text = JSON.stringify(body.errors).toLowerCase()
    if (/jwt|token|unauthori[sz]ed|authenticat|access-denied|invalid-headers/.test(text)) throw new HardcoverError('invalid_token')
    throw new HardcoverError('upstream')
  }
  // A token that parses but belongs to nobody comes back as `me: []`.
  const me = body?.data?.me
  if (!me || (Array.isArray(me) && me.length === 0)) throw new HardcoverError('invalid_token')

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), body })
  return body
}
