# EvoSim 6.1: Reproducible Ecosystem Lab

EvoSim is a browser-based 3D ecosystem sandbox with prey, predators, vegetation, inherited traits, disease, seasons, weather, and local learning. Its experiment tools let you repeat a world from a seed, continue saved simulation state, compare interventions from the same starting state, and inspect imperfect biodiversity observations.

The ecological rules and their parameters are illustrative. Results describe this simulated world and do not establish real animal behaviour, conservation benefits, or field forecasting skill.

## Run locally

Use a modern desktop browser with WebGL and a recent Node.js installation:

```sh
npm start
```

Open [http://127.0.0.1:8766](http://127.0.0.1:8766). The main application is `hybrid-learning-v6.html`; `index.html` opens it automatically. Keep the `src/` and `vendor/` directories beside the HTML file. No build or internet connection is needed to run the app after downloading the complete repository: Three.js r128, its OrbitControls, and Simplex Noise are served locally.

Older versions in `legacy/` and experimental layouts in `experimental/` are separate historical examples.

## Explore the world

- Use the seed control to create a repeatable starting world. Changing the seed starts a new run.
- Pause, resume, or adjust playback speed. Simulation time advances in fixed 1/60-second steps, independent of rendering frequency.
- Select an animal to inspect its energy, health, genes, generation, founder label, and feeding state; follow it with the camera.
- Open **Population & energy census** to inspect births, introductions, deaths, recorded death causes, hunting outcomes, grazing, and vegetation renewal. Compare average energy, resting and feeding animals, surviving founder labels, and recent animal events. Switch the history chart between population, vegetation, and energy; its scale adapts to the data.
- Adjust climate, disease, learning, and habitat settings, or introduce a disturbance. Refuge and corridor interventions preserve the existing terrain and vegetation.
- Toggle terrain overlays, trails, labels, shadows, and particles to inspect the world or reduce rendering load.

Prey and predators forage, hunt, flee, reproduce, and adapt using local information. Offspring combine both parents' traits with mutation. Optional fear fields, soil memory, phenology mismatch, and social imitation expose alternative model assumptions for exploration. A 1,200-agent cap bounds simulation memory and also constrains possible population outcomes.

**Energy-aware hunting** lets satiated animals rest, limits repeated attacks with a cooldown, and transfers captured food into a predator's energy reserve over a feeding interval. Rest and shelter reduce energy expenditure; reaching shelter does not create energy. **Local vegetation renewal** lets depleted plant sites recover at their existing locations, making revisits meaningful. Turning it off restores relocation of renewed plants. Both controls expose model assumptions, with illustrative thresholds and rates.

The census separates introduced animals from births and checks that introductions plus births minus deaths matches the living population. Death categories identify the simulation rule that removed an animal, not an independent diagnosis of all contributing stresses. A founder label follows one initiating parent's inherited label; it is not a complete two-parent pedigree or a measure of genetic diversity.

## Compare interventions

The experiment panel runs the full agent-based simulation forward from a frozen copy of the live world. Choose a horizon of **10–120 simulated seconds** and **2–6 replicates**, then compare the baseline with corridor restoration, a refuge, gene flow, disabled social learning, disabled energy-aware hunting (`energyOff`), or relocated vegetation renewal (`regrowthOff`). The baseline retains the current world's settings, so enable the relevant control before comparing it with its disabled alternative. The live world is restored when the experiment finishes or is cancelled.

Each replicate starts with the same ecology and a different process seed; its baseline and intervention share that seed and initial state. The output retains raw paired results and intervention-minus-baseline differences, which can be exported as CSV. Outcomes include population and vegetation, energy, births and deaths, feeding and renewal events, and living founder labels. Census counters at each endpoint include events already recorded in the frozen starting world. These are short scenario rollouts, not calibrated forecasts or probabilities of extinction. Population gains from gene flow include the introduced animals. The energy-aware comparison changes a group of resting and feeding rules together, so it cannot isolate one physiological mechanism.

Pairing reduces avoidable starting-state differences, but does not guarantee identical subsequent random events: interventions can change which events occur and how many random draws are consumed. A small set of short runs supports only a narrow, configuration-specific comparison. Repeat across different starting worlds before interpreting an apparent effect.

## Inspect simulated eDNA observations

Sentinel sweeps repeatedly sample eco-type signatures within each sensor's local footprint. The observation layer uses its own random stream, so collecting observations does not change the animals' future random choices.

Compare observed signatures with known simulated signatures in the sampled area. Detection coverage is an empirical description of that sweep, **not statistical confidence**, an estimate of whole-world richness, or a validated eDNA assay. Missed detections and false positives illustrate observation error; eco-types are trait categories rather than biological species.

## Save and export

- **Save / Load** stores and restores a snapshot in this browser's local storage.
- **Import checkpoint** restores an exported schema 7 JSON file after validation, or migrates a complete validated EvoSim 6.0/schema 6 checkpoint.
- **JSON export** records the simulation state for inspection and reproducibility.
- **History CSV** records ecosystem measurements.
- **Experiment CSV** records raw paired rollout outcomes and differences.
- **Experiment bundle JSON** also includes the frozen starting checkpoint and configuration, so the comparison can be inspected and reproduced.

Schema 7 snapshots include terrain/vegetation, agents, environmental state, clocks, random generators, attack and feeding timers, pending food, the renewal budget, founder labels, and census state. Exact continuation applies to the same simulator build and browser floating-point runtime; cross-engine bitwise identity is not guaranteed.

Importing a complete 6.0 checkpoint is an explicit **change to 6.1 rules**, not an exact continuation of its old future. Migration starts the census at import, counts the imported living animals as introductions, and initializes the new feeding and renewal state. Founder labels use the oldest retained ancestors; missing historical events and ancestry are not reconstructed. Earlier partial snapshots cannot establish exact replay. Clearing browser site data deletes local saves, so export records you want to keep. Saves do not sync between browsers or devices.

## Development and verification

The browser entry point loads application code and styles from `src/` and third-party libraries from `vendor/`. The local server uses Node.js; simulation execution stays in the browser.

```sh
npm ci
npx playwright install chromium
npm test
npm run check
npm run test:browser
npm run test:observatory
```

These commands run automated checks; their current output is the authority for whether validation passed. Browser checks use the pinned Playwright development dependency and Chromium installed above. The test command starts a local server if one is not already running. Simulation correctness, snapshot continuation, intervention isolation, and browser behaviour are separate from ecological validation.

## Research and scope

[Research notes](docs/research.md) connect the design to primary research published in 2025–2026, with source dates and the limits of each connection. The main lessons are to preserve reproducibility, distinguish observations from ecological state, evaluate predictions against baselines, and test social-learning assumptions across environments.

[EvoSim 6.1 research notes](docs/research-v6.1.md) explain the evidence and engineering inferences behind energy-aware behaviour, feeding time, local resource renewal, and movement changes. The notes distinguish peer-reviewed studies from a 2026 preprint and identify the parts of these mechanisms that remain illustrative design choices.

The app has no continuous connection to a real ecosystem, external field calibration, or independently validated probabilistic forecast model. Early-warning indicators are descriptive model statistics, not demonstrated predictions of a tipping point. Longer-term population viability, real disease transmission, genetic rescue, and management decisions require additional models and empirical evidence.

## Performance

Reduce playback speed or disable shadows, particles, lineage labels, and high pixel ratio on slower hardware. More animals and longer experiment horizons require more computation. Simulation seconds and wall-clock seconds differ when playback speed changes or the computer cannot keep up.

## License

See [LICENSE](LICENSE) for the project license and the retained license notices accompanying vendored dependencies.
