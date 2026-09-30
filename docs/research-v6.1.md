# EvoSim 6.1: energy, feeding, and resource renewal

Research checked on **30 September 2026**. This note supplements [the model description and experiment contract](research.md). Four recent primary sources and one foundational movement study inform the mechanisms below. They do not validate EvoSim's equations, constants, terrain, timescale, or ecological outcomes. The 2026 preprint is identified separately from the peer-reviewed studies.

## Energy expenditure and rest

**Berti, Rosenbaum, and Vollrath — “Energy landscapes direct the movement preferences of elephants.”** *Journal of Animal Ecology* 94, 908–918. First published **25 March 2025**. [Publisher record and abstract](https://besjournals.onlinelibrary.wiley.com/doi/abs/10.1111/1365-2656.70023).

The study analysed movement records from 157 elephants in northern Kenya and related landscape use to locomotion costs, vegetation productivity, and other environmental factors. Individuals generally avoided energetically costly areas and selected productive habitats, with substantial individual variation.

**Engineering inference:** movement should have an expenditure cost, and resting can reduce that expenditure. In EvoSim 6.1, resting and sheltering retain a positive metabolic cost; the shelter rule no longer increases energy merely because an animal arrived at a location. The `energyAware` option also allows satiated animals to rest. Food supplies the energy used for subsequent activity.

**Boundary:** this is an accounting improvement in a synthetic model. The rest multiplier, energy thresholds, and movement cost are illustrative choices, not fitted elephant parameters. EvoSim does not reproduce the paper's energy landscape, measured locomotion costs, or habitat-selection analysis.

## Separate capture from feeding time

**Aranbarri et al. — “Habitat Complexity Reduces the Feeding Strength of Freshwater Predators.”** *Ecology and Evolution* 15, e72258. First published **21 October 2025**. [Published study](https://onlinelibrary.wiley.com/doi/10.1002/ece3.72258).

In aquatic microcosms, the authors varied habitat structure and prey density for two invertebrate predators. Type II functional responses described both predators across the tested structures, while feeding strength and fitted parameters depended on predator and habitat treatment. This provides an empirical example of feeding being limited by more than the presence of prey within reach.

**Engineering inference:** the `energyAware` option gives unsuccessful attacks a cooldown and successful captures a finite handling interval. Captured food enters `pendingMeal` and is transferred into the predator's bounded energy reserve over simulated time. Handling animals cannot immediately capture another prey. Cooldown, remaining handling time, and pending food are state variables required for snapshot continuation.

**Boundary:** the cooldown and digestion schedule are design assumptions. The study does not provide parameters for EvoSim's animals, and no claim is made that its functional-response curve has been reproduced. Habitat complexity can influence encounter, capture, and handling differently; a generic refuge bonus cannot represent all these effects.

## Energy state can change the interaction

**Beardsell et al. — “Integrating predator energetic balance, risk-taking behaviour and microhabitat in functional response to untangle indirect interactions in a multispecies vertebrate community.”** *Functional Ecology* 40, 70–82 (2026 issue). First published **17 November 2025**. [Published study](https://besjournals.onlinelibrary.wiley.com/doi/10.1111/1365-2435.70197).

The authors integrated energetic balance, prey risk, and habitat into a model of Arctic fox foraging and compared predictions with long-term observations. The work supports considering energetic state and behavioural choices together rather than interpreting prey encounter rates alone. It also describes food hoarding as a reason digestion and satiety need not impose the same capture limit in every predator.

**Engineering inference:** expose energy, feeding state, attack attempts, and captures together so a change in prey abundance can be examined alongside its mechanism. An energy-aware on/off experiment tests the combined resting and feeding rules in EvoSim; it does not isolate a single physiological process.

**Boundary:** EvoSim assumes sequential feeding and does not model caches, carcass sharing, or a fitted risk-taking decision model. Its energy values are arbitrary units. Delayed feeding and positive rest expenditure do not establish a closed mass or energy balance: reproduction, vegetation, death, and energy caps still use simplified rules.

## Local renewal makes resource memory testable

**Kilpatrick and El Hady — “Resource depletion accelerates rate learning but not composition learning in patch foraging.”** arXiv:2607.29476v1, submitted **31 July 2026**. **Preprint; peer review is not established by this record.** [Versioned primary manuscript](https://arxiv.org/abs/2607.29476v1).

This theoretical study considers learning while exploiting patchy resources. It distinguishes learning a patch's rate from learning the environment's composition. In its replenishing-patch setting, renewal rate changes the trade-off between revisiting productive patches and exploring the environment.

**Engineering inference:** `localRegrowth` renews a depleted vegetation site at its existing coordinates, retaining a meaningful location for revisits. Turning it off permits the alternative relocation rule. Regrowth work is budgeted by simulated elapsed time, and sequential traversal covers every vegetation slot. These scheduling choices are software requirements, not findings of the preprint.

**Boundary:** EvoSim does not implement the paper's Bayesian learner, optimal policy, or inference hierarchy. Its plant sites are simplified renewable food points, without plant biomass growth, seed dispersal, age structure, or measured nutrient budgets. Local renewal is a testable structural assumption, not a universal description of vegetation recovery.

## Directional persistence and shorelines

**Kareiva and Shigesada — “Analyzing insect movement as a correlated random walk.”** *Oecologia* 56, 234–238, **February 1983**. [Publisher record](https://link.springer.com/article/10.1007/BF00379695) · [Indexed primary abstract](https://pubmed.ncbi.nlm.nih.gov/28310199/).

This foundational study relates displacement to move-length and turning-angle distributions and evaluates the approach with insect observations. The correlated random walk explained some movement sequences and failed for others, illustrating both the usefulness and the limits of a simple movement model.

**Engineering inference:** heading-relative exploration preserves some direction between steps, allowing exploratory movement to cover ground instead of repeatedly cancelling under independent steering perturbations. EvoSim's heading rule remains a heuristic; it is not a fitted correlated random walk or evidence that animal paths match the study.

The shoreline correction is a separate navigation rule: land animals reject steps into deep water and probe alternative directions; already submerged animals can move toward higher terrain. This removes a model trap, without claiming to reproduce swimming, shore habitat preferences, or measured crossing decisions. Quantifying displacement, turn distributions, water entries, and resource encounters would be useful future movement diagnostics.

## Measurements and comparisons

The following are proposed comparisons, not reported empirical findings:

| Comparison | Hold fixed | Inspect |
| --- | --- | --- |
| Energy-aware rules on/off | Starting snapshot, horizon, process-seed pairs, resource rule | Mean energy by type, attack attempts, captures, births, deaths, and population endpoints |
| Local renewal versus relocation | Starting snapshot, horizon, process-seed pairs, energy rules | Renewed sites, grazing events, food abundance, energy, and population endpoints |
| Both mechanisms across independent starting worlds | Prespecified seed set, duration, parameters, and reporting rules | Variation within and between worlds; whether conclusions change by starting ecology |

Run a paired comparison from the same frozen world for each process seed, retain each arm's outcomes, and report intervention minus baseline. Once decisions differ, random draw sequences can diverge; shared seed labels do not guarantee identical subsequent disturbances. A small interactive replicate set is descriptive evidence about this model under that configuration. It is not a calibrated ecological forecast or evidence that an intervention is universally beneficial.

A full 6.0-versus-6.1 comparison changes movement, shoreline handling, energy rules, and resource scheduling together. It measures their combined effect and cannot attribute an outcome to any one change. Within-6.1 energy-aware and local-renewal ablations are narrower comparisons, although `energyAware` itself changes several feeding and rest rules.

Birth, introduction, and death counters make population changes easier to interpret. A population increase caused by introduced animals is not a measured increase in survival or reproduction. Death categories record the rule used by the simulator; they are not causal diagnoses when several stresses occur together.

Founder identifiers describe a single inherited ancestry label through the initiating parent. They are not complete two-parent pedigrees, genetic diversity, effective population size, or proof of adaptive evolution. A richer lineage analysis would need both parents and a documented trait-inheritance model.

## Version and validation boundaries

Snapshot continuation depends on the rule version as well as saved state. Importing a 6.0 snapshot into 6.1 is a **rule-change migration**, not a promise to reproduce its old future. New timers, pending meals, regrowth budget, and census state must be initialized or restored explicitly. Missing historical events and ancestry must not be described as reconstructed observations.

Implementation checks should establish that rest alone cannot increase energy, feeding timers bound repeated captures, local renewal preserves coordinates, every slot is eligible for renewal, and snapshot/experiment restoration preserves the new state. Such checks establish software behaviour. They do not demonstrate ecological calibration, long-term coexistence, improved biological realism, or balanced population dynamics. Those claims would require independent data or prespecified model comparisons beyond a successful browser run.
