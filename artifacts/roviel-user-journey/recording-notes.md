# Recording notes — Roviel full user journey

- Master file: `artifacts/roviel-user-journey/roviel-full-user-journey.webm`
- Format: WebM, VP9, 25 fps (Playwright built-in `recordVideo`)
- Resolution: 1440×900
- Duration: 180.5 s (≈ 3 min 00 s)
- Size: 25,948,072 bytes (≈ 24.7 MiB)
- Verification: `ffprobe` reads valid metadata; full `ffmpeg` decode to null
  passed with no errors (plays beginning to end).
- Method: one continuous headed-Chromium session (`e2e/user-journey.mjs`),
  single page/context, 1440×900 viewport, no devtools/terminals/extra tabs.
  Only the browser viewport was captured; no desktop or personal content.
- Feature sequence: landing → sign-in → dashboard/overview → transactions
  (search/filter/sort/validation/create/edit/delete) → accounts (detail,
  create/rename/delete, transfer) → budgets → goals → converter + provider
  quote/fees → recurring (create/post/cleanup) → insights → theme +
  home-currency preference → reload persistence → sign-out.
- Pacing: deliberate pauses scaled by `TIME_SCALE=3.2` for legibility.
- Test data: disposable local demo DB reseeded before the take; all journey
  test records were deleted except the protected transfer legs and the
  by-design non-deletable test recurring rule.

## Recordly status — PENDING (manual import)
- Recordly (webadderallorg/Recordly, AGPL-3.0 desktop app) is NOT installed here;
  building/installing it was unnecessary for QA, so no `.recordly` project and
  no edited export were created.
- The raw master above is ready for manual import into Recordly.
- Suggested subtle edit only: cursor emphasis, restrained zooms on the totals /
  conversion result / transfer toast, clean transitions. Keep this master file
  unaltered; export any edit as a separate file.
