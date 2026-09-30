# EvoSim 6.1 validation receipt

Verified locally on **30 September 2026**, using Node.js and Playwright Chromium. These checks establish software behavior and configuration-specific outcomes, not biological calibration.

## Current automated checks

- `npm test`: **28 passing tests** covering seeded streams, inheritance, spatial queries, finite meal transfer, elapsed-time renewal, pulse-index equivalence, census accounting, graph scales, schema 7 validation/restore, validated 6.0 migration, and historical large-map regressions.
- `npm run check`: JavaScript syntax passed.
- `npm run test:browser`: **25 passing checks** covering deterministic continuation, observation isolation, interventions, reproduction, attack cooldowns, mid-feeding replay, positive rest cost, shoreline movement, failed-birth accounting, local renewal, census conservation, save/import/export, paired completion/cancellation, mobile controls, and no browser errors.
- `npm run test:observatory`: **8 passing checks** covering census controls, graph units without model mutation, behavior toggles, history CSV, both new paired comparison arms, 6.0-format migration, narrow-screen usability, and no browser errors.
- Develop Web Game skill client completed; WebGL and text captures were inspected. Desktop and narrow-screen census captures were also inspected.
- `git diff --check`: passed. Line-ending normalization warnings are informational.

Interaction suites drive rendering explicitly so idle software WebGL does not compete with model checks. The separate skill client exercises the normal page animation path. Generated screenshots, checkpoints, CSV files, and full experiment bundles remain in ignored `output/`.

## Matched starting worlds: 6.0 versus 6.1

The previous model is frozen at commit `a2ff130376be177f86cac59f845b326da59b3469`. Each version ran for **120 simulated seconds** under its default settings for three seeds. SHA-256 hashes of initial animal identity/type/genes/position/energy records and complete vegetation arrays match across versions for every seed. Multiple rules change together, so this comparison cannot attribute an effect to one mechanism.

| Seed | Prey, 6.0 → 6.1 | Predators, 6.0 → 6.1 | Plants, 6.0 → 6.1 | Starvation while submerged, 6.0 → 6.1 |
| --- | ---: | ---: | ---: | ---: |
| `evosim-2026` | 61 → 189 | 0 → 3 | 702 → 875 | 26 → 0 |
| `meadow-17` | 54 → 144 | 0 → 4 | 614 → 975 | 19 → 0 |
| `wetland-42` | 72 → 137 | 0 → 3 | 539 → 1003 | 18 → 0 |

The 6.1 ledgers balance exactly with introductions, births, and surviving animals in all three runs. They recorded 11/15/11 kills and 16/20/33 starvation deaths respectively. No disease, injury, or age deaths occurred in these short scenarios. The submerged metric counts starvation deaths at terrain height below −1.1; it is not a count of all water encounters.

Higher abundance and short-term predator survival are outcomes, not proof of ecological improvement or long-term stability. Three seeds support only a narrow descriptive comparison. The model still creates simplified newborn energy reserves, uses discrete plant food points, and can produce extinction. Wall-clock timings are excluded because machine suspension and concurrent work affected them; this run is not a performance benchmark.

The portable [comparison receipt](benchmarks/v6.1-comparison.json) retains per-seed 20-second samples, initial hashes, hunting/starvation counts, and 6.1 census totals. To repeat the current version with the local server running:

```sh
node scripts/compare-models.cjs candidate-v6.1 hybrid-learning-v6.html
```

The script also accepts `energy-off` or `regrowth-off` as its final argument. Serve a previous version separately from its frozen checkout/archive; do not overwrite active source to run it. Current script runs preserve completed rows incrementally and record source hashes on successful completion.

## Within-model comparisons and saved state

The observatory suite executes two process-seed pairs at a 10-second horizon for each new arm: energy-aware behavior off, and relocation instead of local renewal. It verifies execution, demographic endpoints and paired differences, and exact restoration of the live checkpoint. These short checks do not establish which setting is preferable across environments.

Schema 7 preserves feeding progress, attack cooldowns, renewal fractions, founder labels, and bounded census events. Population balances and ledger identities are validated before restoring. A complete schema 6 / version 6.0 import explicitly starts **6.1 rules** with new census history; it does not reproduce the old model's future. Imported founder labels reflect only retained ancestry.

Exact continuation is scoped to the same model version and browser floating-point runtime. The historical large-map variant does not inherit the main application's replay or experiment guarantees. See [6.1 research notes](research-v6.1.md) for sources and uncalibrated assumptions.

## Historical 6.0 receipt

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
