// Dev-only convenience: with HARDCOVER_DEV_TOKEN in .env.local, `npm run dev` lets you test with
// your own account without pasting the token into the page. The browser only ever sends the
// placeholder below; the real token stays in the server's environment. Disabled outside `next dev`.
export const DEV_TOKEN_PLACEHOLDER = '__dev_env_token__'
export const SAMPLE_TOKEN = '__sample__'

export function devTokenFromEnv(): string | null {
  if (process.env.NODE_ENV !== 'development') return null
  const value = process.env.HARDCOVER_DEV_TOKEN?.trim().replace(/^bearer\s+/i, '')
  return value || null
}
