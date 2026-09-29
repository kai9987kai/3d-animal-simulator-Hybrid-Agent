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
