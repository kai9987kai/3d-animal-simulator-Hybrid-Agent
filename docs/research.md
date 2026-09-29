# Research basis and model boundaries

Research reviewed on **29 September 2026**. The sources below are primary studies or methodological research, with dates checked on publisher or institutional repository pages. They motivate testable software design choices; they do not validate EvoSim's ecological rules or coefficients.

## 1. Make experiments reproducible before interpreting their outcomes

**Grimm et al. — “Using the ODD protocol and NetLogo to replicate agent-based models.”** *Ecological Modelling* 501, 110967. Published online **6 December 2024**, journal issue **February 2025**. [Published paper and repository record](https://eprints.whiterose.ac.uk/id/eprint/220675/) · [DOI](https://doi.org/10.1016/j.ecolmodel.2024.110967).

The authors used a replication exercise to examine how explicit model descriptions and a shared implementation environment support reproducibility. Their result supports documenting initialization, scheduling, state variables, and assumptions rather than relying on a feature list alone.

**Engineering application:** explicit seeds, fixed simulation steps, isolated simulation/observation/visual random streams, versioned complete snapshots, and raw experiment receipts make EvoSim comparisons inspectable. Saving only animal positions and genes is insufficient for continuation when vegetation, random state, environmental clocks, and agent memory also affect the future.

**Boundary:** these are engineering deductions from the replication principle, not a claim that the paper tested this JavaScript implementation. Repeatability can establish implementation consistency while leaving biological validity unresolved.

## 2. A forecast horizon requires measured verification

**Wesselkamp et al. — “The ecological forecast limit revisited: Potential, absolute and relative system predictability.”** *Methods in Ecology and Evolution* 16, 1521–1541. Published **20 May 2025**. [Paper](https://besjournals.onlinelibrary.wiley.com/doi/full/10.1111/2041-210X.70049).

This framework distinguishes different meanings of forecast limits and demonstrates their estimation with verification data, a scoring function, and a reference for acceptable error. A model's useful horizon can also be defined relative to a benchmark.

**Engineering application:** EvoSim labels its forward runs as short scenario rollouts with explicit simulated-time horizons. A percentage created by a weighted heuristic is not sufficient evidence for a calibrated extinction probability. Baseline and intervention outcomes are exposed directly instead.

**Future experiment:** archive a prediction at issue time, observe its target at a prespecified lead time, and compare its error with persistence. Record multiple starting worlds and uncertainty sources before claiming a supported forecast horizon. A rollout from the same model is not an independent test of real ecological predictability.

## 3. Compare forecasting methods with baselines and uncertainty scores

**Olsson et al. — “What can we learn from 100,000 freshwater forecasts? A synthesis from the NEON Ecological Forecasting Challenge.”** *Ecological Applications* 35, e70004. Published **12 February 2025**. [Paper](https://esajournals.onlinelibrary.wiley.com/doi/10.1002/eap.70004) · [Open manuscript](https://pmc.ncbi.nlm.nih.gov/articles/PMC11816007/).

The study compared prospective probabilistic forecasts across lake sites using baseline models, probabilistic scoring, and interval reliability. Performance varied with forecast horizon and site, illustrating why an attractive trajectory or a single successful run is weak evaluation evidence.

**Engineering application:** export all paired replicate outcomes, preserve the baseline, and state the horizon and number of replicates. Treat differences across process seeds as stochastic variability under the model, not as a full uncertainty assessment. Parameter, structural, initial-state, and observation uncertainty remain separate questions.

**Future experiment:** add archived forecast verification with persistence and seasonal baselines, continuous ranked probability score, and measured interval coverage. The current small rollout ensembles do not establish calibration or statistical significance.

The [21 May 2026 erratum](https://esajournals.onlinelibrary.wiley.com/doi/10.1002/eap.70202) corrects a cited reference's year and identity; it does not report a change to these evaluation methods.

## 4. Keep the observation process separate from ecological state

**Ovaskainen et al. — “A digital twin for real-time biodiversity forecasting with citizen science data.”** *Nature Ecology & Evolution* 10, 481–495. Published **27 January 2026**. [Paper](https://www.nature.com/articles/s41559-025-02966-3).

This real-world bird-monitoring system updates its model from observations, accounts for sampling and detection, and tests next-day predictions using later data including independent expert observations. Its design separates the processes contributing to an observed detection.

**Engineering application:** keep sentinel observations separate from hidden simulation state and retain sampling location, effort, and error. Sampling alone should not grant an animal a survival benefit or mechanically lower an ecological risk score. Display empirical detection coverage with a clear denominator instead of calling a hand-built score “confidence.”

**Boundary:** EvoSim observes a synthetic world and has no field-data update loop. The research supports a useful architecture for observation experiments; it does not make the sandbox a validated digital twin or transfer the paper's measured accuracy to this model.

## 5. Spatial support matters for eDNA interpretation

**Silva et al. — “Modelling the spatial bound of an eDNA signal in the marine environment – the effect of local conditions.”** *Frontiers in Marine Science* 12, 1613001. Published **5 September 2025**. [Paper](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2025.1613001/full).

The modelling study examined how local hydrodynamics and decay affect where an eDNA signal may originate. It also reported a gap between some modelled and observed dispersal distances, underscoring the need to validate spatial assumptions.

**Engineering application:** compare a simulated sentinel's detections with the signatures actually present in its own footprint, use repeated samples, and report false positives and missed detections. A locally incomplete survey cannot be scored as if it sampled the whole world.

**Boundary:** the paper concerns marine transport. EvoSim's simplified terrestrial sensor footprint omits shedding, transport, molecular degradation, extraction, amplification, and taxonomic reference databases. It illustrates sampling error, not an eDNA laboratory workflow or a transferable detection model.

## 6. Test the conditions under which social information helps

**Wu et al. — “Adaptive mechanisms of social and asocial learning in immersive collective foraging.”** *Nature Communications* 16, 3539. Published **25 April 2025**. [Paper](https://www.nature.com/articles/s41467-025-58365-6).

In a human virtual-foraging experiment, the researchers examined adaptive individual and social learning under different resource structures. Selective responses to observed success and the individual's own recent success were central modelling ingredients; social information and competition operated together.

**Engineering application:** use paired social-learning-on/off experiments and vary resource structure or disturbance conditions. Record population and resource outcomes rather than assuming imitation must help. The existing local imitation rule is an explicit experimental assumption, not a reproduction of the paper's fitted decision model.

**Boundary:** human behaviour in a virtual task does not validate prey or predator behaviour. This is algorithmic inspiration. The [20 June 2025 correction](https://www.nature.com/articles/s41467-025-61159-5) fixes an author's name and does not alter the findings discussed here.

## Experiment contract

The current rollout comparison uses a frozen live snapshot and advances the same agent-based rules in each arm. Independent replicate seeds vary process randomness; baseline and intervention are paired within each replicate. Each replicate shares the starting ecology. Exported records retain the starting configuration, horizon, replicate identity, raw outcomes, and paired differences. The live world is restored on completion or cancellation.

- A horizon is **10–120 simulated seconds**, not ecological days or a validated forecast limit.
- **2–6 replicates** make the interactive experiment tractable but provide limited evidence, particularly for rare events.
- Shared initial states and seeds control part of the comparison. Once treatment changes births, interactions, or event counts, random draw sequences may diverge; pairing does not imply identical later disturbances.
- An intervention can immediately change population size. Its total effect includes that direct addition; a larger terminal population alone does not demonstrate increased survival or reproduction.
- Endpoint differences are descriptive outcomes of these runs. They are not confidence intervals, calibrated probabilities, field estimates, or universal intervention rankings.
- Synthetic ground truth enables observation diagnostics that would be unavailable in ordinary field monitoring. Those diagnostics evaluate this sensor model only.
- The 1,200-agent cap is a computational constraint that also affects population dynamics; results near the cap require that qualification.

## Compact model description

**Purpose and entities.** An interactive spatial sandbox for exploring simplified ecological and evolutionary mechanisms. Entities are prey, predators, vegetation patches, environmental fields, and sensor locations. Eco-types are categories derived from model traits.

**Space and time.** A bounded procedural terrain is rendered in 3D. Behaviour advances at a fixed 60 steps per simulated second; playback speed controls how quickly those steps are requested. Season and day cycles use the simulator's internal time scale.

**Processes and scheduling.** Local resource and environmental updates interact with agent movement, perception, decisions, disease, learning, reproduction, and death. The implementation in `src/` defines their precise order. Rendering and sentinel sampling use separate random streams so observation and visual work need not consume the simulation's random state.

**Initialization and inputs.** Seeded terrain, initial agents, and browser controls define an artificial initial state. A saved schema 6 snapshot restores dynamic state for continuation within the same simulator build and browser floating-point runtime. Cross-engine bitwise replay is not guaranteed. No real-world measurements, fitted species parameters, or external climate records are assimilated.

**Outputs and interpretation.** Population counts, resource abundance, trait summaries, local detections, time series, and paired intervention differences describe model behaviour. Reproducibility checks verify implementation properties. They do not demonstrate ecological realism, predictive skill, or practical management efficacy.
