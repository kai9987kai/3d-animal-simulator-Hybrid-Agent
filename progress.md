Original prompt: innovate improve and advance in every way refine look at the best and new research to help

## Direction
Preserve the existing 3D ecology model while correcting timing, inheritance and habitat intervention defects. Add seeded repeatability, complete validated snapshots, honest replicated scenario experiments, responsive UI, and research documentation.

## Initial audit
Clean main at ed41e6e. README points at a nonexistent file. Simulation and rendering are coupled in a single HTML file; save files are incomplete.

## Implemented
- Split current entry into locally served source modules and pinned, MIT-noticed vendor libraries. Added npm start/test/check/test:browser.
- Seeded fixed 60Hz model, independent sensor/visual randomness, stable agent IDs, complete validated schema6 checkpoint import/export, detached snapshots and exact continuation.
- Corrected compounded speed, dead-target consumption, two-parent inheritance, weather/field time, sample cadence, pathogen history IDs, founder land placement, mating priority/cooldowns, and spawning visuals.
- Habitat interventions preserve terrain and resources; local plant spatial lookup replaces global random probing; phenology means cached each tick.
- Full-model paired intervention experiments (corridor/refuge/gene flow/social imitation ablation), bounded horizons/replicates, progress/cancel, live-state restore, raw CSV and full JSON bundle.
- Replicated local sentinel observations with empirical coverage and separate observation RNG.
- Responsive field-station interface, mobile control drawer, compact animal silhouettes merged into one draw call, clearer terrain, inspector and keyboard controls.
- Experimental large map: retain newborns; match mesh to terrain height queries; retain shared species geometry; exclude empty food; fix angular wrap.
- Six primary research sources from 2025-2026, model boundary notes and usable README entry.

## Validation
- Node tests: 13 passed. JavaScript syntax checks and git diff --check passed.
- Final browser suite: 19 passed, including habitable founders, reproductive priority, exact continuation, speed/observation isolation, save/import/export, paired completion/cancellation, mobile controls and no runtime errors.
- Extended 120-simulation-second smoke: no errors, 46 births, max generation 3, 61 prey, 0 predators, 702 plants for evosim-2026/default settings. Predator extinction is a result, not a validated balanced ecosystem; no universal survival or predictive claims.
- Verified valid surveyed checkpoint restore, actual animal selection, and speed-zero ecology stability. Screenshot artifacts in output/browser.
- Game skill client run and screenshots inspected. WebGL toDataURL needed optional ?capture=1 to preserve the framebuffer; ordinary page screenshots render normally. A headed run produced a valid terrain/animal capture, though its initial optional click timed out; direct browser tests separately verified pause/step.

## Remaining boundaries
- No field calibration, forecast skill measurement, or cross-browser bitwise guarantee. Historical large-map variant still has camera-driven ecology and population replenishment; only targeted correctness fixes applied there.
- Current source remains uncommitted; publishing was not requested.

Final full experiment JSON export verified in Chromium: exported bundle retains both paired rows and schema6 starting checkpoint. Local server remains on 127.0.0.1:8766.

## 30 September 2026: EvoSim 6.1 continuation

User asked to innovate and advance further, then to continue. The prior work had been committed at a2ff130; that commit was archived separately as the 6.0 comparison baseline.

- Added energy-aware satiation/rest, finite feeding and attack cooldowns; shelter keeps positive metabolism. Successful offspring creation precedes charging parents.
- Added heading-relative exploration and shoreline navigation that rejects deep-water entry and permits uphill recovery for previously submerged imports.
- Renewed vegetation stays at its patch by default; elapsed-time budgets and sequential traversal avoid the old stride-17 coverage defect. Added relocation and energy behavior ablations.
- Added census/causes/feeding/founder dashboard, population/resource/energy history views with dynamic scales, inspector feeding/lineage details, and richer history/experiment exports.
- Added indexed environmental pulse queries and render-once-per-frame animal synchronization.
- Schema7/version6.1 preserves all new state. Complete 6.0 imports explicitly migrate to new rules and new census history. Review added strict population balance and complete ledger-event validation before restoration.
- Four recent primary studies plus a foundational movement study are documented in docs/research-v6.1.md with model boundaries.
- Final validation: 28 unit tests, 25 core browser checks, 8 observatory browser checks, syntax checks and git diff --check passed. Skill-client WebGL and desktop/mobile census screenshots inspected.
- Three matched initial-state hashes, 120 seconds each: submerged starvation 26/19/18 -> 0/0/0; predator survivors 0/0/0 -> 3/4/3. Full receipt and limits in docs/benchmarks/v6.1-comparison.json and docs/validation.md. Timing excluded because host suspension/concurrent workloads affected elapsed wall time.
- Current changes are local; publication/commit was not requested. No remaining required task work. Future research: longer independent-seed runs, movement distributions, fitted resource/energy budgets, and full two-parent pedigree if useful; current founder label is single-parent ancestry.
