import { NextResponse, type NextRequest } from 'next/server'
import { fetchReadBooks, HardcoverError } from '@/lib/hardcover'
import { normalizeToken, toPayload } from '@/lib/stats'
import { DEV_TOKEN_PLACEHOLDER, SAMPLE_TOKEN, devTokenFromEnv } from '@/lib/devToken'
import sample from '@/lib/sample.json'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

const DEMO_SHELF_URL = process.env.DEMO_SHELF_URL ?? 'https://www.allenliu.dev/api/books/shelf'

async function fetchDemoShelf(): Promise<unknown | null> {
  try {
    const res = await fetch(DEMO_SHELF_URL, { signal: AbortSignal.timeout(6000), next: { revalidate: 600 } })
    if (!res.ok) return null
    const body = await res.json()
    return body?.data?.me ? body : null
  } catch {
    return null
  }
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE })
}

// POST { token, year? } -> computed stats for that year. The token travels in the body (never the
// URL), is forwarded to Hardcover for this one request, and is not logged or stored.
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', 400)
  }
  const year = typeof body?.year === 'number' && Number.isInteger(body.year) && body.year > 1900 && body.year < 3000 ? body.year : null
  const today = new Date().toISOString().slice(0, 10)

  let token = normalizeToken(body?.token)
  if (token === SAMPLE_TOKEN) {
    // "Try it with mine": Allen's real shelf, served by allenliu.dev (its server holds the token).
    const shelf = await fetchDemoShelf()
    if (shelf) return NextResponse.json({ ...toPayload(shelf, year, today), demo: true }, { headers: NO_STORE })
    return NextResponse.json({ ...toPayload(sample, year, today), username: 'sample', sample: true }, { headers: NO_STORE })
  }
  if (token === DEV_TOKEN_PLACEHOLDER) token = devTokenFromEnv() ?? ''
  if (!token || token.length > 4096 || /\s/.test(token)) return fail('invalid_token', 401)

  try {
    const raw = await fetchReadBooks(token)
    return NextResponse.json(toPayload(raw, year, today), { headers: NO_STORE })
  } catch (error) {
    if (error instanceof HardcoverError) {
      if (error.code === 'invalid_token') return fail('invalid_token', 401)
      if (error.code === 'rate_limited') return fail('rate_limited', 429)
      console.error(`Hardcover request failed (${error.status ?? 'network'})`)
    } else {
      console.error('Unexpected error building wrapped stats')
    }
    return fail('upstream', 502)
  }
}
