# Project Status

Status date: 2026-05-05
Current version target: `v0.2.3 Game-algorithm`
Overall phase: Match simulation fidelity and game-algorithm upgrade
Chosen stack: Option A local-first SPA

## Snapshot

The project now has a runnable browser build.

What is now stable:

- the product direction is web-first
- the player fantasy is coach and manager, not athlete control
- the MVP is singles-first and tournament-first
- the technical direction is a local-first React, TypeScript, and Vite stack
- the documentation hierarchy has been converted into an agent-first harness
- the deterministic match engine is implemented
- the 16-player knockout flow is implemented
- local persistence is implemented
- the command-center app shell is implemented
- the setup, overview, live match, and recap screens have been rebuilt for `v0.2`
- `v0.2.1` completed the command-center patch and UI rearrangement work
- `v0.2.2` completed expanded roster content and deterministic event draws
- `v0.2.3 Game-algorithm` is the active feature target for detailed active-match simulation and quick background-match simulation
- the detailed/quick simulation fidelity boundary is implemented
- non-managed tournament matches now use quick simulation while managed matches remain detailed
- detailed rallies now use a staged `32`-shot cap with `18` as a warning threshold rather than a hard stop
- neutral detailed exchanges now damp safe-shot pressure so clears, lifts, blocks, and serves stabilize rallies more than attacking shots do
- quick simulation now has first-pass OVR softening plus long-tail aggregate rally sampling
- match balance now has a repeatable calibration command and reference report for OVR-gap fairness
- live managed matches now progress point by point instead of set by set
- scouting, telemetry, directives, and recap aggregation are implemented
- between-set talks visibly queue during intermissions before applying at the next set
- the command center renders the full 16-player binary knockout path through the final
- top navigation and sidebar console options are clickable, including compact tactic and event controls
- the overview command center uses a head-to-head next-opponent comparison with tactic lock-in beside it
- the local roster now contains 47 fictional athletes, including six Trophy Titans and 15 Honorable Mentions, with setup selection sorted by OVR, nationality-code identifiers beside names, and each tournament drawing exactly 16 entrants for novelty

## Completed

- [x] stack options reviewed
- [x] Option A selected
- [x] stable PRD drafted
- [x] technical brief drafted
- [x] initial subsystem reference docs drafted
- [x] first version packet drafted
- [x] Vite React TypeScript app scaffolded
- [x] deterministic rally, set, and match engine implemented
- [x] 16-player seeded tournament flow implemented
- [x] local persistence implemented
- [x] unit tests, build verification, and browser smoke test passing
- [x] `v0.2` command-center shell implemented
- [x] `v0.2` setup, bracket, live match, and recap screens implemented
- [x] `v0.2.1` patch packet created
- [x] documentation pointers moved to `v0.2.1` for the command-center patch
- [x] point-by-point live managed match flow implemented
- [x] live directives, between-set talks, scouting, and recap telemetry implemented
- [x] between-set team-talk selection feedback and interval-only engine guard implemented
- [x] full binary knockout tree with future-round placeholders implemented
- [x] clickable top navigation and sidebar console option controls implemented
- [x] overview layout revised with head-to-head comparison and right-side tactic lock-in
- [x] README-centered docs converted into `AGENTS.md` plus structured `docs/` source-of-truth lanes
- [x] agent-first documentation harness recorded in `docs/decisions/ADR-002-agent-first-documentation-harness.md`
- [x] `v0.2.2` roster draw expansion packet created
- [x] active documentation pointers updated to `v0.2.2`
- [x] expanded the player pool to 47 athletes, reserved title-style names for Trophy Titans and Honorable Mentions, and added deterministic 16-player tournament draws from the larger pool
- [x] capped ordinary fictional depth players at 86 OVR while keeping Honorable Mentions in the 85-88 band
- [x] sorted setup roster selection by OVR descending and replaced seed labels with OVR rank labels
- [x] changed setup athlete identifiers from name initials to nationality codes and grouped names beside them
- [x] documented the proposed high-fidelity active-match algorithm and quick background-match simulation plan
- [x] created the `v0.2.3 Game-algorithm` release packet and updated active documentation pointers
- [x] implemented `SimulationFidelity`, detailed/quick dispatch, and the quick point simulator
- [x] routed non-managed tournament matches through quick mode while preserving detailed managed matches
- [x] persisted tournament match fidelity and background summary events
- [x] surfaced compact background match summary events in the knockout bracket
- [x] added unit coverage for quick determinism, scoring rules, stronger-player batch behavior, and tournament fidelity routing
- [x] replaced the detailed rally `18`-shot hard cap with named tuning constants and a staged `32`-shot cap
- [x] implemented neutral-shot pressure dampening, late-rally continuation stress, and fatigue/pressure-based capped-rally resolution
- [x] tuned the first quick-mode OVR softening pass and long-tail rally-length sampler
- [x] added `npm run calibrate:match` and documented a 21,620-match balance sweep in `docs/reference/match-balance-calibration.md`

## In Progress

- [ ] tune balance and upset frequency
- [ ] calibrate quick mode against detailed mode across wider seeded matchup bands
- [ ] reduce detailed-mode certainty in `5+` OVR buckets without flattening elite player identity
- [ ] tune expanded-roster special-archetype balance against the ordinary fictional field
- [ ] improve commentary variety and phrasing
- [ ] expand post-match stats and scouting reads
- [ ] polish responsive behavior and visual details across the new shell

## Next

- [ ] add seeded batch calibration checks for quick versus detailed simulation parity
- [ ] tune quick and detailed three-game rates, average points, and rally-length distributions toward closer parity
- [ ] stage detailed rally cap testing through `48`, and then `70`
- [ ] add optional calibration assertions behind `MATCH_BALANCE_ASSERT=1`
- [ ] deepen the tactical intel layer with richer contextual explanations
- [ ] add more differentiated live directives and opponent pattern reads
- [ ] tighten save migration coverage for future `v0.2.x` changes

## Blockers

There are no hard technical blockers right now.

Current design questions that could affect scope:

- how aggressively to tune upset frequency before expanding the manager loop
- what calibration bands should align quick background outcomes with detailed match outcomes
- how much tactical explanation belongs in the persistent `TACTICAL_INTEL` surface versus local screen copy
- how much save migration coverage is needed before future `v0.2.x` changes become risky
- how much of the richer active-match algorithm should ship before quick simulation calibration is considered good enough

## Risks

### 1. Scope creep

The project will slow down badly if it adds:

- doubles
- long-term career systems
- live backend features
- detailed court animation

### 2. Engine ambiguity

If the rally model is not documented clearly before coding, tuning will become guesswork.

### 3. UI-first drift

If the browser shell is built before the engine contract is stable, the project may accumulate presentation code that later has to be rewritten.

## Maintainer Notes

Future sessions should read these files first:

- `AGENTS.md`
- `docs/README.md`
- `docs/product/PRD.md`
- `docs/product/ROADMAP.md`
- `docs/plans/active/project-status.md`
- `docs/reference/match-engine.md`
- `docs/reference/match-simulation-fidelity.md`
- `docs/product/versions/v0.2.3/v0.2.3.md`

## Update Rule

Whenever the project changes materially, update this document in the same pass.

At minimum, revise:

- `Completed`
- `In Progress`
- `Next`
- `Blockers`
- `Status date`
