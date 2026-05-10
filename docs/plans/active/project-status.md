# Project Status

Status date: 2026-05-11
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
- stat composition now has a same-OVR archetype calibration command and beat-by-beat rating influence report
- live managed matches now progress point by point instead of set by set
- scouting, telemetry, directives, and recap aggregation are implemented
- between-set talks visibly queue during intermissions before applying at the next set
- the command center renders the full 16-player binary knockout path through the final
- top navigation and sidebar console options are clickable, including compact tactic and event controls
- the overview command center uses a head-to-head next-opponent comparison with tactic lock-in beside it
- the local roster now contains 47 fictional athletes, including six Trophy Titans and 15 Honorable Mentions, with setup selection sorted by OVR, nationality-code identifiers beside names, and each tournament drawing exactly 16 entrants for novelty
- `v0.2.4 UI Framework and Season-Ready Layout` is drafted as the planned bridge release after `v0.2.3`, focused on page-level feature separation, runtime-generated player profiles, consolidated settings, pop-up windows, and UI preparation for larger event selection, seasons, and calendars
- the first `v0.2.4` UI code slice now adds generated player profiles, a squad directory, player-name navigation, consolidated settings, theme accent choices, and reset confirmation while keeping simulation outcomes untouched
- the player profile overview now behaves more like a scout dossier, with radar metrics, archetype, strengths, weaknesses, tactical fit drivers, readiness, and smart player-name links inside prose
- the player profile overview now fits as a compact one-screen desktop dashboard, fixes radar label clipping, and supports a resizable/collapsible persistent sidebar
- the tournament setup athlete picker now leads with playstyle/strength recommendation modes, features the strongest choice in a `1 x 2` coach-pick card with four compact alternatives, and moves country, search, tier, style, and sort controls into the Browse All Athletes fallback
- the first career core slice is implemented with a version `3` save payload, typed `game/career/*` modules, calendar/event entry, training/recovery, fatigue/injury readiness, ranking points, budget ledger, and career-aware pre/post match hubs
- first launch now visibly presents paired `Start Tournament` and `Start Career` decisions
- the command shell now exposes a Save Manager for the single local slot, including continue career, export JSON, import preview/confirm, active-save deletion, corrupt-backup deletion, and overwrite warnings
- the career workspace now has visible route chrome and an in-page Career Home map for Training, Calendar/Event Desk, Match Planning, Live Match, Post-Match Review, Save Manager, and New Session actions

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
- [x] added `npm run calibrate:stats` and documented same-OVR stat composition balance in `docs/reference/stat-composition-calibration.md`
- [x] retuned displayed OVR to count recovery, pressure resistance, judgment, and rally tolerance more honestly
- [x] reduced long-rally safety, improved wide-placement pressure, and gave movement stats late-rally stability value
- [x] created the planned `v0.2.4 UI Framework and Season-Ready Layout` release packet
- [x] added `v0.2.4` to the roadmap as the UI framework bridge before `v0.3`
- [x] amended the `v0.2.4` documentation with the FM-inspired badminton player profile page, runtime player-page generation decision, player-name navigation rules, and consolidated settings pop-up direction
- [x] implemented the first `v0.2.4` code slice for runtime-generated player profiles, squad directory navigation, consolidated settings, theme accent choices, and reset confirmation
- [x] upgraded the player profile overview into a Football Manager-style scout report with radar metrics, archetype, strengths, weaknesses, risk flags, readiness, and smart player-name linking in profile prose
- [x] compressed the player profile Overview into a one-screen dashboard at `1440 x 900`, added short-viewport compact mode for `1366 x 768`, fixed the radar safe drawing area, and made the sidebar resizable, collapsible, and locally persistent
- [x] refined setup player selection into a playstyle-first recommendation flow with a featured coach-pick layout plus full-roster search, country, tier, style, and stat sort controls
- [x] added the Phase 1 career core vertical slice across save migration, calendar/event entry, training/recovery, health, ranking, economy, pre-match hub, post-match hub, unit tests, and Playwright reload proof
- [x] added the first-launch dual path and Save Manager trust slice with import/export/delete/recovery coverage
- [x] added the career workspace navigation shell and in-page management map for the core career route family

## In Progress

- [ ] tune balance and upset frequency
- [ ] calibrate quick mode against detailed mode across wider seeded matchup bands
- [ ] reduce detailed-mode certainty in `5+` OVR buckets without flattening elite player identity
- [ ] improve detailed-mode counterattack conversion for high-speed archetypes
- [ ] tune expanded-roster special-archetype balance against the ordinary fictional field
- [ ] improve commentary variety and phrasing
- [ ] expand post-match stats and scouting reads
- [ ] polish responsive behavior and visual details across the new shell
- [ ] review the career workspace route shell for responsive density, route contract clarity, and later-wave scope boundaries before deeper calendar/ranking integration
- [ ] review the first-launch and Save Manager surfaces for copy, visual density, and mobile ergonomics before larger save/history features

## Next

- [ ] add seeded batch calibration checks for quick versus detailed simulation parity
- [ ] tune quick and detailed three-game rates, average points, and rally-length distributions toward closer parity
- [ ] stage detailed rally cap testing through `48`, and then `70`
- [ ] add optional calibration assertions behind `MATCH_BALANCE_ASSERT=1`
- [ ] add optional stat-composition assertions behind `STAT_COMPOSITION_ASSERT=1`
- [ ] use `docs/product/versions/v0.2.4/v0.2.4.md` as the next release packet once `v0.2.3` exits active algorithm tuning
- [ ] use `docs/product/versions/v0.2.4/player-profile-and-shell-amendment.md` as the implementation guide for the player profile page and shell/settings cleanup
- [ ] decide whether `v0.2.4` should keep internal SPA page state or introduce URL routes
- [ ] confirm whether the future `32` selectable items should be called games, events, competitions, or tournaments in player-facing UI
- [ ] deepen the tactical intel layer with richer contextual explanations
- [ ] add more differentiated live directives and opponent pattern reads
- [ ] tighten save migration coverage for future `v0.2.x` changes
- [ ] tune Phase 1 career economy values, event tier rewards, and training load numbers after review feedback

## Blockers

There are no hard technical blockers right now.

Current design questions that could affect scope:

- how aggressively to tune upset frequency before expanding the manager loop
- what calibration bands should align quick background outcomes with detailed match outcomes
- how much tactical explanation belongs in the persistent `TACTICAL_INTEL` surface versus local screen copy
- how much save migration coverage is needed before future `v0.2.x` changes become risky
- how much of the richer active-match algorithm should ship before quick simulation calibration is considered good enough
- whether `v0.2.4` should adopt URL routes or keep a typed internal page registry inside the current SPA shell
- whether the first calendar should use fixed fictional dates or seed-generated dates
- how much of the full player profile should ship as page content in `v0.2.4` versus remain as focused overlays or later season/career scaffolds

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
- `docs/product/versions/v0.2.4/v0.2.4.md`
- `docs/product/versions/v0.2.4/player-profile-and-shell-amendment.md`

## Update Rule

Whenever the project changes materially, update this document in the same pass.

At minimum, revise:

- `Completed`
- `In Progress`
- `Next`
- `Blockers`
- `Status date`
