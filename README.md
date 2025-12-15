# Hardcover Wrapped

A Spotify-Wrapped-style recap of a year of reading, from your [Hardcover](https://hardcover.app) account.

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # stats unit tests (vitest)
npm run build
```

Connect with your personal API token from https://hardcover.app/account/api. The token is kept in the
browser only (sessionStorage, or localStorage if you tick "remember"). `/api/wrapped` forwards it to
Hardcover for one read-only GraphQL query and returns computed stats; results are cached in memory for
two minutes keyed by a SHA-256 of the token. Nothing is logged or stored.

No token? "Try it with mine" shows my own shelf: the server fetches it from
`https://www.allenliu.dev/api/books/shelf` (override with `DEMO_SHELF_URL`), where my site's server holds
my token, and falls back to the bundled sample if that's unreachable.

Dev-only: put `HARDCOVER_DEV_TOKEN=...` in `.env.local` (gitignored) to get a "use dev token" button
under `next dev`, so the token never has to be pasted into the page. It is ignored in production.
