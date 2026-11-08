# Roviel V1 — Release Notes (prepared 2026-11-06)

**Status: ready for release review. Nothing in this working tree has been committed, pushed or deployed — every change below awaits owner approval.**

Roviel is a multi-currency personal finance tracker: a cinematic public landing page, a live reference-rate converter, a provider quote comparator, and an authenticated ledger with accounts, budgets, goals, recurring rules and deterministic insights — plus an offline-first local demo that keeps working with no API.

Live: [roviel.vercel.app](https://roviel.vercel.app) · API: [health](https://ledgerly-api-4yhc.onrender.com/health) · demo login `demo@ledgerly.app` / `ledgerly123`

---

## What shipped in this finalisation pass

### Responsive completion (web)
- **Top safe-area handling** — the landing stage and the sticky dashboard bars now respect `env(safe-area-inset-top)` (previously only bottom/left/right were handled). Notched devices in `viewport-fit=cover` no longer place the brand bar under the status bar.
- **44 px touch targets** — Pulse pair mini-tabs, segmented controls and the More-sheet close button now meet the 44 × 44 CSS-pixel minimum on coarse-pointer devices, joining the existing mobile-nav and More-sheet options.
- **More-sheet semantics** — the sheet already behaved modally (scrim, focus trap, Escape, focus restore); `aria-modal` now says so.
- **Tablet input zoom** — the 16 px anti-iOS-zoom rule now applies to every coarse-pointer device, not only those under 900 px wide (fixes iPad-landscape zoom).
- **Invisible edit icons fixed** — the goal edit and account rename pencils rendered at 0 px wide; tool-button icons now have explicit sizing like every other icon in the app.

### Testing & CI
- **Responsive suite hardened** (`e2e/responsive.mjs`): runs the full 16-viewport matrix under **both themes** (Ink + Paper) — **319 checks**; unexpected browser page errors now **fail** the suite; cloud-view checks fail loudly instead of silently skipping (opt-out: `RESPONSIVE_CLOUD_OPTIONAL=1` records an explicit skip with its reason).
- **CI release gate** (`.github/workflows/ci.yml`): a dedicated `responsive` job runs the suite against a disposable Postgres with the API + web dev servers, uploads failure evidence, and fails the workflow — alongside the existing build/lint/unit/E2E jobs.
- **Production-safety guards**: the demo seed and the API integration test **refuse non-local databases/APIs** unless deliberately overridden (`ALLOW_NONLOCAL_SEED=1`, `ALLOW_NONLOCAL_TEST_TARGET=1`). A stale `server/.env` can no longer wipe the production demo.
- **User-journey suite repaired** (`e2e/user-journey.mjs`): nav selectors updated to the current dashboard navigation (the old `.dash-side-nav` no longer exists) and the script now reseeds the demo first, like `test:e2e` — **44/44 checks pass** and the recorded walkthrough is reproducible.

### Financial correctness (verified, with new regression coverage)
- The API integration suite now asserts the V1 acceptance cases explicitly: a **2,000-unit budget reports a 2,000-unit limit and 0 % spend** before transactions exist; a **1,000-unit contribution raises a goal's saved amount by exactly 1,000 units**; a malformed JSON body returns **400**, not a misleading 503.
- Stale-rate labelling now uses one shared threshold (the cache fallback previously disagreed with the live-rate path by a day).
- Unchanged by design: BigInt minor-unit money with per-currency exponents, atomic linked transfers with persisted FX quotes, and no silent rewriting of historical amounts.

### Documentation
- README test counts corrected to measured values (150 E2E checks; 319 responsive checks across both themes), `test:api` and `test:journey` documented, CSV export described accurately (server JSON, client-built CSV with formula-injection escaping), uptime workflow wording matched to reality, and the new seed/integration production guards documented.

## Verification summary (this working tree, 2026-11-06)

| Check | Result |
| --- | --- |
| Lint (`oxlint --deny-warnings`) | PASS — 0 warnings, 0 errors |
| Unit tests (minor-unit maths) | PASS — 9/9 |
| Frontend build (Vite) | PASS |
| API build (TypeScript) | PASS |
| API integration (154+ assertions) | PASS |
| E2E (real Chromium) | PASS — 150/150 |
| Responsive (16 viewports × 2 themes) | PASS — 319/319 |
| User journey (recorded walkthrough) | PASS — 44/44 |
| Production smoke (read-only) | PASS — web, DB health, fresh USD/EUR rate, 181 currencies, auth boundary |

## Production & recovery verification — owner actions required

These need dashboard/credential access and were **not** executed here; treat them as the release checklist:

1. **Verify Render `roviel-api` points at Neon** — Render dashboard → Environment → confirm `DATABASE_URL` host is the Neon project (not the retired Render DB). The `/health` endpoint already reports `database: up`.
2. **Fresh backup** — `DATABASE_URL='<neon-direct-url>' ./scripts/backup-neon.sh`, then confirm the dump is non-empty and `pg_restore --list` validates it. Store outside the repo (`backups/` is gitignored).
3. **Restore drill** — `SOURCE_DATABASE_URL='<neon>' DRILL_DATABASE_URL='<disposable-target>' DRILL_CONFIRM=RESTORE-DRILL ./scripts/restore-drill.sh` against an empty local/disposable database. Never `restore-neon.sh` against production as a test.
4. **Retired Render DB (`ledgerly-db`)** — after 1–3 pass and no rollback requirement remains, let it expire on its scheduled 2026-11-22 suspension; deletion is the owner's call.
5. **Vercel ↔ GitHub auto-deploy** (issue #9) — Vercel dashboard → Project → Git Integration → connect `saransh-dev12/roviel`, Production branch `main`, confirm `VITE_API_URL` for Production and Preview, then push a controlled commit.

## Known limitations (documented, accepted for V1)

- Render free tier sleeps after ~15 min idle; first request can take ~30 s.
- Recurring "post now" is manual by design: the UI disables the button while posting and each post advances the period. Server-side per-period idempotency would need a rule↔transaction schema link — noted as future work, deliberately not added to V1.
- Public FX endpoints stay unauthenticated because the public converter is an advertised no-signup feature; the global 240 req/min limit and upstream caching bound the surface.
- Auth tokens live in `localStorage`; all server-data render paths use HTML escaping. Refresh-token rotation/TOTP remain backlog (issue #10) — the audit found no concrete V1 defect in the current revocation design.
- Physical-device checks (notch behaviour, on-screen keyboard) are covered by emulation here; a spot check on a real device is recommended before announcement.
- `src/` contains the archived React prototype and some unused dependencies (`react-router-dom`, `recharts`, `tailwindcss`); the live app is the single-file vanilla-JS app in `index.html`, as documented in `AGENTS.md`.

## Artifacts

- Screenshots (desktop + mobile, both themes): `artifacts/v1-audit/`
- Walkthrough video (90 s, headless Playwright): `artifacts/roviel-user-journey/roviel-full-user-journey.webm`
