# EvoSim 5.0: Experimental Ecological Digital Twin

**EvoSim 5.0** is a single-file, browser-based 3D ecosystem simulator built with **Three.js**. It models prey, predators, vegetation, terrain, seasons, weather, disease, genetics, adaptive behaviour, and experimental ecological-digital-twin tools in one interactive lab.

This version keeps the core EvoSim features while adding research-inspired systems such as eDNA sentinel monitoring, short-horizon risk forecasting, landscape-of-fear feedbacks, niche-construction soil memory, phenology mismatch, adaptive social imitation, assisted gene flow, and experimental disturbance pulses.

---

## Demo

Open the HTML file directly in a modern browser:

```text
evosim5_experimental_ecological_digital_twin.html
```

No build step is required.

---

## Key Features

### 3D Ecosystem World

- Procedural 3D terrain with height, moisture, fertility, water, fog, lighting, and day/night cycles.
- Dynamic vegetation regrowth based on fertility, seasons, climate stress, weather, and local ecological memory.
- Minimap with terrain, vegetation, prey, predators, sickness, and selected-agent highlighting.
- Optional habitat heatmap for visualising high-quality patches.

### Adaptive Agents

Agents are split into:

- **Prey**
- **Predators**

Each agent has inheritable traits:

- Size
- Speed
- Sense range
- Immunity
- Boldness
- Memory
- Behavioural policy weights
- Generation
- Eco-type classification

Agents can:

- Forage
- Hunt
- Flee
- Wander
- Patrol
- Sleep
- Reproduce
- Become infected
- Recover or die
- Leave pheromone/fear signals
- Adapt through social imitation
- Pass mutated genes to offspring

### Research-Inspired EvoSim 5 Systems

#### eDNA Sentinel Network

A simulated biodiversity-monitoring layer inspired by environmental DNA sampling.

- Sensors estimate local biodiversity with noise and confidence.
- Detection bias can undercount or overcount nearby eco-types.
- Sentinel logs help compare observed biodiversity with actual simulation state.

#### Micro-Forecast Digital Twin

A short-horizon forecasting panel estimates near-future ecosystem risk.

It compares scenarios such as:

- Do nothing
- Restore habitat corridors
- Assisted gene flow
- Predator pressure changes
- Climate or disturbance stress

The goal is not perfect prediction, but interactive ecological decision support.

#### Landscape of Fear

Predator attacks and predator presence create spatial fear fields.

Effects include:

- Prey avoid risky areas.
- Foraging shifts away from predator hotspots.
- Plant recovery can indirectly change when grazing pressure moves elsewhere.
- Fear fades over time, creating dynamic spatial memory.

#### Niche-Construction Soil Memory

Animal movement, feeding, and deaths can create or alter nutrient hotspots.

Effects include:

- Local fertility memory.
- Spatially uneven vegetation regrowth.
- Feedback loops between grazing, movement, and plant recovery.

#### Phenology Mismatch

Climate drift can desynchronise reproduction timing from seasonal resource peaks.

Effects include:

- Lower reproductive success under mismatch.
- Stronger climate stress consequences.
- Trait selection pressure toward more flexible agents.

#### Adaptive Social Imitation

Agents can copy successful nearby behavioural policies.

This creates:

- Local behavioural cultures.
- Faster adaptation than genetics alone.
- Risk of maladaptive copying during sudden regime shifts.

#### Assisted Gene Flow

An intervention button introduces new founder prey with higher thermal tolerance and plasticity.

Use this to test:

- Genetic rescue
- Population recovery
- Trait mixing
- Possible ecological side effects

#### Novel Predator Pulse

Adds a sudden pressure from a new predator type or predator wave.

Use this to test:

- Trophic cascades
- Prey collapse risk
- Refuge/corridor value
- Recovery dynamics

### Disease and Pathogen Dynamics

- Disease pressure slider.
- Pathogen pulse event.
- Immunity-based infection and recovery.
- Sick agents are visually marked.
- Infection can spread among nearby agents.
- Disease contributes to extinction risk and diversity loss.

### Climate, Weather, and Disturbance

- Climate stress slider.
- Climate trend/drift controls.
- Storm event.
- Drought event.
- Habitat fragmentation.
- Corridor restoration.
- Regeneration / new map.
- Seasonal changes in temperature and plant growth.

### Research and Monitoring UI

The research panel tracks:

- Diversity index
- Mean prey speed
- Mean predator sense
- Extinction risk
- Resilience warning signals
- eDNA sentinel readings
- Forecasted risk
- Lineage/event log

The graph panel tracks:

- Prey count
- Predator count
- Vegetation count
- Genetic diversity
- Additional trait and risk signals depending on version settings

### Inspector

Click an animal to inspect it.

The inspector shows:

- Agent type
- ID
- State
- Energy
- Health
- Age
- Generation
- Eco-type
- Size gene
- Speed gene
- Sense gene
- Immunity gene
- Behavioural policy

Camera can follow the selected animal.

### Save, Load, and Export

- Save simulation state to browser `localStorage`.
- Load saved state later.
- Export population history as CSV.
- Export richer state snapshots as JSON.
- Use outputs for comparison, debugging, classroom experiments, or further analysis.

---

## Controls

### Simulation Controls

| Control | Description |
|---|---|
| Sim Speed | Speeds up or slows down the simulation. |
| Terrain Chaos | Regenerates rougher or smoother landscapes. |
| Climate Stress | Increases environmental pressure. |
| Mutation Rate | Controls inherited trait variation. |
| Disease Pressure | Increases infection risk and disease impact. |
| Add Prey | Adds new prey agents. |
| Add Predator | Adds new predator agents. |
| Storm | Starts a storm disturbance. |
| Drought | Starts a drought disturbance. |
| Pathogen Pulse | Infects a subset of agents. |
| Regen Map | Generates a new terrain and vegetation map. |
| Pause / Resume | Stops or restarts simulation time. |
| Save / Load | Stores or restores the simulation in browser storage. |
| Export CSV | Downloads population history. |
| Export JSON | Downloads richer experiment state, if enabled. |
| Research View | Opens or closes the research panel. |

### Rendering Layers

| Option | Description |
|---|---|
| Pheromone trails | Shows agent trail markers and event traces. |
| Shadows | Toggles Three.js shadow rendering. |
| Weather / particles | Shows rain, drought dust, fireflies, and other particles. |
| Habitat heatmap | Shows fertility and suitability overlay. |
| Lineage labels | Shows eco-type and generation labels above agents. |
| High pixel ratio | Improves rendering sharpness on high-DPI screens. |
| Camera mode | Orbit, follow selected, or cinematic camera. |

---

## Suggested Experiments

### 1. Predator-Prey Balance

1. Start with default settings.
2. Let the ecosystem run for several days.
3. Increase predator count.
4. Watch whether prey collapse, adapt, or recover.

Observe:

- Prey population
- Predator population
- Vegetation recovery
- Extinction risk
- Diversity index

### 2. Climate Stress Test

1. Increase climate stress gradually.
2. Trigger drought.
3. Watch plant recovery and prey starvation.
4. Use assisted gene flow.
5. Compare recovery before and after intervention.

Observe:

- Mean prey speed
- Diversity index
- Vegetation count
- Phenology mismatch effects
- Forecasted risk

### 3. Disease and Immunity Selection

1. Increase disease pressure.
2. Trigger pathogen pulse.
3. Let several generations pass.
4. Check whether immunity rises in surviving lineages.

Observe:

- Sick count
- Mean immunity in inspected survivors
- Population bottlenecks
- Eco-type turnover

### 4. Habitat Fragmentation

1. Add fragmentation or raise climate stress.
2. Watch movement and reproduction decline.
3. Restore corridors.
4. Compare population recovery.

Observe:

- Local extinctions
- Agent movement routes
- eDNA sentinel readings
- Risk forecast

### 5. Landscape of Fear

1. Add predators.
2. Watch where prey stop foraging.
3. Observe whether plants recover in predator-heavy zones.
4. Remove or reduce predator pressure and compare.

Observe:

- Fear fields
- Prey movement
- Vegetation patchiness
- Predator-prey spatial separation

---

## Research Concepts Represented

EvoSim is a simplified interactive model, not a formal scientific simulator. However, it draws inspiration from current ecological modelling ideas:

- **Agent-based modelling**: individual organisms act from local perception and internal state.
- **Eco-evolutionary dynamics**: inherited traits affect survival and reproduction over generations.
- **Spatial ecology**: terrain, moisture, fertility, refugia, and fragmentation shape outcomes.
- **Digital twins**: live state monitoring plus scenario comparison.
- **eDNA monitoring**: imperfect biodiversity detection from sentinel sensors.
- **Early-warning indicators**: rising variance, autocorrelation, and population instability can indicate resilience loss.
- **Landscape of fear**: predator risk changes prey behaviour and indirectly affects vegetation.
- **Niche construction**: organisms alter their environment, which feeds back into future survival.
- **Phenological mismatch**: climate shifts can desynchronise life cycles and resource timing.
- **Assisted gene flow**: introducing adaptive traits may rescue populations but can have side effects.

---

## Technical Details

### Built With

- HTML
- CSS
- JavaScript
- Three.js r128
- OrbitControls
- Simplex Noise

### Architecture

The simulation uses:

- A Three.js scene for terrain, water, lighting, agents, particles, and overlays.
- A spatial hash grid for faster local neighbour lookups.
- Instanced vegetation rendering for performance.
- Procedural terrain generated from layered simplex noise.
- Per-agent genetics and state machines.
- Local browser storage for saving state.
- Canvas-based graph and minimap rendering.

### Main Systems

| System | Purpose |
|---|---|
| `Agent` | Handles prey/predator genetics, movement, decisions, disease, reproduction, and death. |
| `SpatialHash` | Speeds up neighbour queries. |
| `Pheromones` | Renders fading event trails. |
| `WeatherSystem` | Handles storm/drought particles and disturbance timers. |
| `Fireflies` | Adds night-time ambience. |
| Terrain generation | Produces height, moisture, fertility, and colour data. |
| Vegetation system | Spawns, hides, consumes, and regrows plants. |
| Research panel | Displays biodiversity, risk, trait, and event summaries. |

---

## Installation

No installation is required.

1. Download the HTML file.
2. Open it in Chrome, Edge, Firefox, or another modern browser.
3. Allow the page to run JavaScript.
4. Start experimenting.

For best results, use a desktop browser with hardware acceleration enabled.

---

## Performance Tips

If the simulation becomes slow:

- Turn off shadows.
- Turn off particles.
- Turn off lineage labels.
- Disable high pixel ratio.
- Reduce sim speed.
- Avoid adding too many agents.
- Regenerate the map if vegetation becomes very dense.

---

## Browser Storage Notes

Save/load uses:

```js
localStorage
```

This means:

- Saves are stored only in the current browser profile.
- Clearing site data may delete the saved simulation.
- Saves do not automatically sync between devices.
- Export JSON/CSV if you want portable experiment records.

---

## Limitations

EvoSim is designed for exploration, education, and creative experimentation.

It is not:

- A validated ecological forecasting model.
- A replacement for field data.
- A formal population viability analysis tool.
- A calibrated conservation-planning system.

The model simplifies real ecology heavily. Use it to explore mechanisms and hypotheses, not to make real-world management decisions.

---

## Future Ideas

Possible next upgrades:

- Real experiment manager with repeated trials and statistical summaries.
- Multiple biome presets.
- Food-web expansion beyond prey/predator/plants.
- Parasites, mutualists, decomposers, and pollinators.
- Agent genomes with recombination instead of direct mutation only.
- Neural-network policy visualiser.
- WebGPU renderer for larger populations.
- Import/export of scenario presets.
- Replay timeline and event bookmarks.
- Side-by-side intervention comparisons.
- More formal ODD protocol export.

---

## Credits

Created as an experimental browser ecosystem lab using Three.js and procedural simulation techniques.

EvoSim 5.0 focuses on interactive eco-evolutionary behaviour, ecological digital twin concepts, and accessible research-inspired experimentation in a single HTML file.
