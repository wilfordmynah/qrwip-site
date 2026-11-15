# QRwip
- `public/` the website, plus /account (login + dashboard) and /claim
- `functions/[code].js` redirect: qrwip.com/0012 -> that sign's destination
- `functions/api/[[path]].js` login, claim, list signs, update a sign
- `schema.sql` database tables (safe to re-run)
- `scripts/make-order.mjs` creates a claim code + printable card for an order
- `.dev.vars` local testing only: prints sign-in links in the terminal (never deployed)

Local test: npx wrangler pages dev public   then open http://localhost:8788/account/
