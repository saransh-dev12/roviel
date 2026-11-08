# Roviel

**Give every currency a direction.** A full-stack, multi-currency finance tracker — a cinematic landing with an interactive 3D coin that disintegrates as you scroll, a live reference-rate converter, and an authenticated ledger with accounts, budgets, goals, recurring rules and evidence-based insights.

**Live:** [roviel.vercel.app](https://roviel.vercel.app) · [API health](https://ledgerly-api-4yhc.onrender.com/health) · demo login `demo@ledgerly.app` / `ledgerly123`

> The API runs on Render's free tier and sleeps after ~15 minutes idle, so the first cloud request can take ~30 seconds. The offline demo is instant.

## What's inside

- **Landing** — a four-slide scroll story (one flick = one slide) where a 3D coin disintegrates into particles and reintegrates; works with and without WebGL.
- **Public converter + quote comparator** — 200-currency directory, dated reference rates, provider quote + fee breakdown with exact `BigInt` minor-unit maths. The reference rate is never auto-filled into the provider field.
- **Dashboard** — 8 views: Overview, Transactions, Accounts, Budgets, Goals, Recurring, Insights, Currency Pulse. Command palette (`⌘K`), detail drawers, sparkline metric cards with month-over-month deltas, odometer tickers, atomic cross-currency transfers with FX capture, budgets with burn-down bars, goals with contributions, one-tap recurring rules, full-ledger export with formula-injection escaping, deterministic insights.
- **Two themes** — Ink (near-black) and Paper (warm ivory), one design system: self-hosted Space Grotesk / Inter / IBM Plex Mono, native dialogs, keyboard-operable charts and palette, reduced-motion support.
- **Offline-first** — the anonymous demo keeps working with no API: localStorage ledger and local analytics, honestly labelled.

## Architecture

```
Browser (Vite, vanilla JS + ES modules)
  ├── index.html            landing + dashboard + converter
  ├── public/roviel-api.js  thin API client (additive; demo works without it)
  └── e2e/                  Playwright suites
        │  HTTPS + Bearer JWT
        ▼
Express API (TypeScript)
  ├── routes: auth · accounts · transactions · finance · fx · insights
  ├── middleware: requireAuth, rate limit, helmet, CORS, zod validation
  └── lib: money (BigInt minor units) · fx (Frankfurter + fallback, cached in Postgres)
        │  Prisma ORM
        ▼
PostgreSQL (Neon) — 11 tables, user-scoped by userId on every query
```

**Rules that hold everywhere:** money is integer minor units + ISO currency (never floats); original amounts and the reporting rate are stored together; transfers are atomic and both legs linked; every query is filtered by `userId`; the API never trusts client-supplied amounts or account ids.

## Run it locally

```sh
docker compose up -d db          # Postgres 16 on :5432
cd server
cp .env.example .env             # set DATABASE_URL + a long JWT_SECRET
npm install && npx prisma migrate deploy
npm run seed                     # demo@ledgerly.app / ledgerly123
npm run dev                      # API on :4000
# second terminal, repo root:
npm install && npm run dev       # web on :5173
```

## Testing

```sh
npm run test:unit        # minor-unit maths: JPY (1), KWD (1000), fees
npm run test:api         # API integration (needs API + Postgres running locally)
npm run test:e2e         # reseeds the demo, then 151 Playwright checks
npm run test:responsive  # 16-viewport matrix × both themes (319 checks)
npm run test:journey     # recorded user-journey walkthrough (reseeds first)
npm run smoke:prod       # production smoke, read-only
npm run lint             # oxlint
```

The E2E suite asserts exact values, not labels: a ₹250 expense raises spending by exactly ₹250, a ₹2,000 budget reports 0% spend, a ₹1,000 contribution moves a goal by exactly ₹1,000, a ₹100 transfer debits ₹100, recovery codes are single-use, forgot-password is non-enumerating, CSV escapes formulas. The responsive suite covers both themes with page errors failing the run. CI runs unit + E2E + responsive as release gates; the seed refuses non-local `DATABASE_URL` targets unless `ALLOW_NONLOCAL_SEED=1`.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signup` · `/login` · `/me` (`GET`/`PATCH`) | Account lifecycle (bcrypt + JWT, 12h sessions) |
| `POST /api/auth/forgot-password` · `/reset-password` · `/recover-with-code` | Single-use, expiring resets; ten one-time recovery codes |
| `POST /api/auth/change-password` · `DELETE /api/auth/account` | Revoke sessions / delete everything |
| `GET/POST/PATCH/DELETE /api/accounts` · `/api/transactions[/:id]` | Multi-currency accounts and ledger entries |
| `POST /api/transactions/transfer` | Atomic cross-currency transfer with FX capture |
| `GET/POST/DELETE /api/budgets` · `/api/goals` · `/api/recurring` | Budgets, goals, recurring rules (+ `/post`, `/contribute`) |
| `GET /api/fx/rate` · `/history` · `/currencies` · `POST /api/fx/quote` | Reference rates and fee-aware quotes |
| `GET /api/summary?months=N` · `/api/insights` | Server-side totals, months, budgets, goals, insights |

## Deployment

**Vercel** (frontend) · **Render** (API, Docker, Singapore) · **Neon Postgres** (database). Live: [roviel.vercel.app](https://roviel.vercel.app) · API `https://ledgerly-api-4yhc.onrender.com` (service `roviel-api`, health `/health`).

1. **Database** — free Neon project (Vercel Marketplace, Singapore), direct/unpooled URL for Render; `prisma migrate deploy` runs in the API container on start.
2. **API** — Render Docker service, `rootDir: server`, env `DATABASE_URL`, `FRONTEND_URL` (CORS allow-list), `JWT_SECRET`, optionally `RESEND_API_KEY` + `EMAIL_FROM`. Auto-deploy is deliberately off.
3. **Frontend** — Vercel project linked via CLI; `VITE_API_URL` set for Production/Preview. A release is:
   ```sh
   git push && render deploys create srv-dbdidass728c73c30920 --confirm && vercel deploy --prod && npm run smoke:prod
   ```
4. **Seed** — `DATABASE_URL='<url>?sslmode=require' ALLOW_NONLOCAL_SEED=1 npm run db:seed` (the guard makes an ordinary local run unable to touch production).

## Backup & recovery

```sh
DATABASE_URL='postgresql://…neondb?sslmode=require' ./scripts/backup-neon.sh
DATABASE_URL='…' RESTORE_CONFIRM=RESTORE ./scripts/restore-neon.sh backups/roviel-neon-….dump
SOURCE_DATABASE_URL='…' DRILL_DATABASE_URL='…' DRILL_CONFIRM=RESTORE-DRILL ./scripts/restore-drill.sh
```

Neon needs the Postgres 18 Docker client (`backup-neon.sh`/`restore-neon.sh`); `backup-db.sh`/`restore-db.sh` remain for Postgres 16 targets. The drill script dumps, refuses non-empty targets, restores, and compares every table and migration count. `backups/` is gitignored — never commit dumps or credentials. `.github/workflows/uptime.yml` smokes production every 30 minutes.

## Security & correctness

- Startup refuses weak/missing `JWT_SECRET`, missing `DATABASE_URL`, or wildcard CORS. Access tokens last 12h; logout and password changes revoke old sessions server-side (`tokenVersion`).
- Reset tokens are 256-bit, SHA-256-stored, single-use, 30-minute expiry; forgot-password responses never reveal whether an email exists. Without Resend configured, production returns a clear 503 — ten single-use recovery codes are the always-available fallback.
- Accounts start at zero; entries match their account's currency; missing FX is reported `null`, never faked as `1`; deletion requires password + `DELETE`.
- A `401` clears cloud state and asks you to sign in — a failed cloud write never silently falls back to the local ledger.
- The client renders server data through HTML escaping; CSV exports escape formula injection.

## Limitations

- Render free tier sleeps (~30s cold start); the uptime workflow may show an occasional timeout right after a wake.
- Recovery email needs `RESEND_API_KEY` + `EMAIL_FROM`; until then the 503 is honest and recovery codes cover sign-in.
- Vercel auto-deploy needs the GitHub connection added in the Vercel dashboard; until then releases are the CLI command above. The old Render Postgres expired naturally and is no longer referenced.
- Refresh-token rotation and TOTP are deliberately out of scope (issue #10).

## Privacy & data

Roviel stores only what you enter, scoped to your account, and deletes everything on account deletion. The anonymous demo never leaves the browser. No third-party analytics, no ad tracking. Reference rates come from [Frankfurter](https://frankfurter.dev/) (central-bank blended, wide-coverage fallback) — informational and dated, never a provider quote. Three.js 0.160 is vendored under `public/vendor/three/` (MIT) so the signature scene has no CDN dependency.

## Credits

Design patterns adapted as original code from public inspiration: Refero Styles (Ramp, Mercury, Linear, Steep), Details.so, Framer Finsaro, shadcn/ui (MIT), Skiper UI (free-tier attribution per its terms), Componentry (MIT), DesignSpells. No reference source code or assets are bundled; Three.js, `@floating-ui/dom` and all fonts are MIT/OFL licensed and self-hosted.
