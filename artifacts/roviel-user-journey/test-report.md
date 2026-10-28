# Roviel user-journey test report

Target: LOCAL stack only — `http://localhost:5173` + `http://localhost:4000`
Database: local Postgres via `server/.env` (verified `localhost`, no Neon/Render host).
Seed: `npm run db:seed` before each run (resets the `demo@ledgerly.app` user only).
Runner: `e2e/user-journey.mjs` (`npm run test:journey`), visible Chromium 1440×900.
Result: **44/44 journey checks passed** on the final recorded take.

## A. Sign-in and initial experience — PASS
- Landing shows Roviel branding with a visible sign-in control.
- Auth modal opens; demo credentials submitted through the visible form.
- Sign-in succeeds; status pill switches to CLOUD SYNC (authenticated cloud mode,
  distinct from the LOCAL DEMO offline state).
- Dashboard loads; totals labelled (balance ₹4,14,796.00, income ₹5,82,000.00).

## B. Overview — PASS
- Spending detail drawer opens with real categories; closes cleanly.

## C. Accounts — PASS
- Account list shows names, currencies and balances (Cash/HDFC INR, Revolut USD).
- Per-account detail drawer opens with available/opening/net balances.
- Test USD account created, renamed (via prompt), deleted; other accounts remain.

## D. Transactions and activity — PASS
- 40 seeded rows render; search filters; empty search shows the empty state;
  type filter and sort controls work.
- Blank/negative submit rejected with an inline error.
- Test expense (+₹25) moves spending by exactly ₹25; edit persists; test income
  created and deleted; test expense deleted afterwards.

## Transfers — PASS
- INR→INR preview shows the pair; transfer records with toast confirmation.

## E. Budgets and goals — PASS
- Budgets list months/progress; test budget created and deleted.
- Goal created with deadline, ₹100 contribution adds exactly ₹100, goal deleted.

## F. Currency conversion and fees — PASS
- 250 USD → 222.78 EUR matches the dated reference rate; date/inverse shown.
- Provider quote (0.86 + 2/1%/5% fees) renders the net/difference breakdown.
- Disclaimer present: Roviel does not execute exchanges. Dialog closes cleanly.

## G. Recurring and insights — PASS
- Rules listed; test rule created, posted once, posted entry verified then deleted.
- 4 insight cards render with evidence references.

## H. Theme and preferences — PASS
- Theme toggle changes `noir` → `brutal` and back.
- Home currency saved (USD then restored to INR).

## I. Persistence and sign-out — PASS
- Reload restores the open dashboard, session and totals.
- Sign-out returns to LOCAL DEMO with a Sign in button.

## Automated suites (same day)
- `npm run lint` — passed, zero warnings.
- `npm run test:e2e` — **146/146 passed** (reseeds demo first).
- `npm run test:unit` — 9/9; `npm run test:api` — passed;
  `npm audit --omit=dev` — 0 vulnerabilities (root + server).
