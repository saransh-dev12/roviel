# Bugs found during journey QA

All three were found in dry runs, fixed in working-tree code, and re-verified.
No unresolved defects remain from this QA pass.

## 1. Journey script used the wrong add-transaction button — FIXED
- Repro: on the Transactions view the script clicked `#open-transaction`
  (the Overview button, hidden there) and timed out.
- Expected: the Transactions view exposes `#open-transaction-2`.
- Fix: `e2e/user-journey.mjs` uses `#open-transaction-2` on that view.
- Severity: test-script only; no app change. Verified 44/44 after fix.

## 2. Currency dialog did not close on Escape in that flow — FIXED (test-side)
- Repro: after the quote checks, `Escape` left `#currency-tools-dialog` open,
  blocking sidebar clicks.
- Expected: dialog closes before continuing.
- Fix: journey closes via the explicit `#close-currency-tools` button and
  asserts the dialog is closed.
- Severity: test-script only; no app change. Verified 44/44 after fix.

## 3. Reload-restore state broke the journey's landing-CTA assumption — FIXED
- Repro: after reload the app correctly restores the open dashboard
  (`#dashboard` hash), so `.contact-btn` is covered and unclickable.
- Expected: script must handle the restored state instead of assuming landing.
- Fix: journey detects `#dashboard-view.open` after reload and only clicks
  the landing CTA otherwise; the restore itself is asserted as a PASS.
- Severity: test-script only; no app change. Verified 44/44 after fix.

## Notes (not defects)
- Recurring rules have no delete action by design; the journey cleans up only
  the posted test entry. The test rule itself remains in the disposable local DB.
- Transfer legs are protected from deletion by design (reverse via new transfer).
- Rename/delete flows use native `prompt`/`confirm`; functional, kept as-is.
