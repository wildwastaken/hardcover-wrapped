import { NextResponse } from 'next/server'
import { devTokenFromEnv } from '@/lib/devToken'

export const dynamic = 'force-dynamic'

// Says only whether a dev token is configured. Never returns the token.
export function GET() {
  return NextResponse.json({ available: devTokenFromEnv() !== null }, { headers: { 'Cache-Control': 'no-store' } })
}
