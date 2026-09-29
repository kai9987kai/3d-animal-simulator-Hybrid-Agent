# Validation receipt

Verified locally on 29 September 2026 with Node 24.13.1 and Playwright Chromium.

- `npm test`: 13 passing tests covering random streams, biparental inheritance, spatial indexing, summaries, complete checkpoint validation/restore, atomic rejection, and large-map birth/terrain/angle regressions.
- `npm run check`: application, script, test, and experimental inline JavaScript syntax passed.
- `npm run test:browser`: 19 passing checks. Includes identical seeded worlds, habitable founders, reproduction priority, exact checkpoint continuation, speed and observation isolation, local intervention preservation, invalid imports, dead-prey handling, fixed history cadence, save/load/export/import, paired rollouts and cancellation, four intervention arms, empty surveys, responsive controls, and no browser errors.
- Full experiment bundle download separately verified: two paired rows plus the complete schema6 starting checkpoint.
- `node scripts/extended-smoke.cjs`: 120 simulated seconds, valid checkpoints throughout, actual pointer-based animal selection, surveyed-checkpoint restore, speed-zero ecology stability, and no runtime errors.
- Desktop, inspector, mobile controls, and headed WebGL captures inspected. Optional `?capture=1` retains the WebGL buffer for canvas-based capture; ordinary page screenshots do not need it.
- `git diff --check`: passed.

The default-seed extended run ended with 61 prey, zero predators, 702 plants, and 46 births; maximum surviving generation was 3. This is one synthetic scenario. It verifies continuation and exercised reproduction, not ecological balance, calibrated forecasting, or real-world biological validity. Predator extinction remains a legitimate possible outcome.

Generated screenshots, raw endpoint receipts, snapshots, and CSV/JSON experiment records are in the ignored `output/` directory. The historical large-map variant received targeted correctness tests; it does not inherit the main app's replay or experimental guarantees.
