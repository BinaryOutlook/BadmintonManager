# Project Status

Status date: 2026-07-13
Current version target: `v0.3 Stable Career System`
Overall phase: stable career-system foundation and controlled expansion on top of the completed `v0.2.4` UI/career/save bridge and the `v0.2.3` match-algorithm baseline
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
- the career workspace now has visible route chrome and an in-page Career Home map for Training, Calendar, Match Planning, Live Match, Post-Match Review, Save Manager, and New Session actions
- the Career Home and Calendar now surface the fictional circuit calendar/ranking model: event tiers, entry deadlines, eligibility gates, ranking cutoffs, seed snapshots, draw milestones, points, prize/cost, readiness, and season-race stakes with a simplification boundary
- public event tiers now use fictional `Circuit 300`, `Circuit 500`, `Circuit 750`, and `Circuit 1000` labels while legacy save imports normalize the previous tier text safely
- the quick tournament event now uses the fictional `Harborline Open` name; legacy local/imported saves that still contain the old real event name are normalized during load/import
- Phase 3 proof captured 36 desktop/mobile screenshots plus storage reset and import-validation evidence; no video proof is currently part of the shipped evidence pack
- the UIUX1Change state-flow regression slice now locks career creation to an explicit managed athlete, guards active-career selection paths after reload, and keeps non-final career event wins alive into the next managed-round briefing
- the tournament continuation hardening slice now exposes tournament completion/still-in-event/next-opponent helpers, uses them in store/UI continuation paths, prevents repeated final-placement reward settlement, and proves active between-round saves through import preview
- the UIUX1Change start-screen slice now opens on a direct Start Screen, routes Quick Tournament through the editable setup path, requires a career-athlete confirmation dialog before writing `career.program.managedPlayerId`, and keeps active-career squad/profile views inspect-only
- the active-career Quick Tournament path now keeps its draft athlete local until explicit replacement confirmation, preserving the career save's `career.program.managedPlayerId` while starting the replacement quick run with the drafted athlete
- career creation and Quick Tournament launch now share a blocking playstyle-first athlete selection modal; both require an explicit modal-session athlete pick, career writes `career.program.managedPlayerId` only on confirm, and Quick Tournament keeps compact `Strategic Override` tactic selection plus active-career replacement safety
- the UIUX1Change shell-standardization slice now uses one grouped command rail with Core, Program, Match, Operations, and System commands; the former top nav and global career route strip are removed, while Settings and Save Manager stay reachable through shell system controls
- the shell overlay remediation now moves focus into Settings and confirmation dialogs, traps Tab and Shift+Tab inside the active modal, closes Settings on Escape, cancels confirmations on Escape, and restores focus to the invoking control after close
- the UIUX1Change dense-page fidelity slice now makes Portal Home the active-career operations hub with tasks/inbox, next event, calendar snapshot, readiness/ranking pressure, recent match evidence, save state, and visible route actions while daily continuation lives in the global topbar resolver
- the TIX-029 Portal Home optimization now promotes `Next Decision` into the dominant consequence-first work surface, gives readiness one primary `Player Condition` owner, shows urgent-only tasks, upgrades the week strip with deadline/travel/match/recovery/open labels, and demotes ledger/ecosystem inventory into compact later context
- training, calendar/competition, match planning, live match, and post-match review now expose compact management status strips above their grids, tables, telemetry, and decision panels
- Save Manager now leads with active slot metadata for slot state, mode, managed athlete, save version, import preview, and quarantine state while preserving export, import preview/confirm, active-save deletion, and corrupt-backup deletion safety
- the rescue MVP Workstreams A/C slice now centralizes valid career day advancement in the topbar, removes the Calendar-only Advance Day control, and routes match-day advances into the career pre-match hub without bypassing pre/post/live competition states
- the rescue MVP Workstreams E/F UI slice now renames the runtime page to `Calendar`, removes the legacy mixed Calendar naming, expands the Calendar into a full-width Upcoming layout, and adds a safe `Past Events` coming-state without changing the domain history schema
- the disposable-run knockout tree is now a reusable `KnockoutTree` component shared by Overview, Career Pre-Match, and Career Post-Match hubs while preserving clickable player names, placeholders, scorelines, managed-path highlighting, champion styling, and background match summaries
- the live Match Command Center now uses a compact horizontal command surface with the primary point action beside the scoreboard, the tactical feed/viewer/telemetry/options visible across desktop viewports, and focused regression proof for duplicate action prevention
- the live Match Command Center now uses a compact broadcast-style score strip with `Next Point` / `Finish Set` transport controls, removes the repeated status strip, and reframes the tactical viewer as a badminton-native `Rally Pattern Map`
- the Rescue MVP Plan 1 domain foundation now enforces schedule-aware career day advancement, spaces managed R16/QF/SF/F rounds across separate event dates, persists `eventHistory`, and migrates older saves safely
- Rescue MVP Plan 2 now adds a shared career daily-action resolver: the topbar turns red for required `Play`, `Resume Match`, or `Review Match` work and stays green only when `Advance Day` is safe
- entered Calendar rows now expose playable due-event actions instead of becoming disabled after entry
- Rescue MVP Plan 3 now makes event opening event-id-safe, keeps entered future events from hijacking the active competition, renders real paged Upcoming/Past Calendar records, adds event details routing for `View Entry`/`View Draw`, removes lower sidebar context/tactic/athlete blocks, removes the Portal Home in-page `Continue`, and keeps the fresh Start Screen outside the career shell until a save or run exists
- the event catalog is now MVP-debug friendly: only `Summit Invitational` and `Continental Premier` keep meaningful locks, `Season Finals` moves to week 52, and six additional fictional events fill the late-season calendar for paging and repeated entry testing
- the Career Portal dashboard now uses a compact one-page command grid with a slim route strip, central next-decision panel, table-like tasks/evidence/ledger, a timeline week strip, and dense ecosystem chips without changing career simulation or store behavior
- `v0.3 Stable Career System` is now the active release target: the career loop is stable from launch through Save Manager, Calendar, Training, Match Planning, Live Match, and Post-Match Review
- the `v0.3` career system is intentionally limited: it proves the local-first manager loop with one locked managed athlete, fictional event/ranking structures, compact resource pressure, and safe saves before later versions expand flexibility and realism
- the live Match Command Center now renders a BWF-style set scoreline strip with set columns, server/transport context, focused desktop/mobile proof, and no repeated current-point column
- the Start Screen hierarchy now has calmer no-save, active-career, active-quick-run, and corrupt-save states with committed visual QA artifacts under `docs/rescue_MVP/visual_qa/TIX-005/`
- the TIX-007 Start Screen refinement tightens the hero into a launch title bar, makes saved career/tournament resume panels the dominant decision, groups Start New and Local Setup actions more naturally, adds restrained court-line badminton identity, and commits refreshed visual QA artifacts under `docs/rescue_MVP/visual_qa/TIX-007/`
- detailed match scorelines now use bounded score-shape safety rails, score-aware anti-collapse relief, and opt-in calibration assertions to prevent repeated pathological `21-0`, `21-1`, and `21-2` games in normal roster matchups
- the command rail now keeps Calendar focused on event browsing and sends bracket, pre-match, and active-match paths through Live Match instead of a separate permanent competition command
- TIX-011 adds a first-class career Rankings page from the command rail, sourced from `career.rankings`, with full rank-ascending rows, managed-athlete labelling, profile-addressable names, and bounded desktop/mobile proof
- TIX-009 universal player addressing now gives profile links stable player-id navigation across setup, career hubs, live match, bracket, scouting, post-match, and prose surfaces
- the TIX-008 tournament-home slice now routes Calendar rows and Past Events through stable `seasonId + eventId` tournament homes, reduces Calendar row detail density, renders future/active/completed tournament states, and stores optional bracket snapshots for newly completed career events while old archives fall back safely
- TIX-013 now persists completed managed career matches and final champion/runner-up achievements, letting Player Profile Career tabs show real W-L, win percentage, titles, finalist results, and profile-linked head-to-head archives without fabricating old history
- TIX-014 adds a Calendar View commitments tab that date-groups managed match commitments from entered schedules, active known opponents, TBD future rounds, and recorded `career.matchHistory` W-L results while preserving Upcoming/Past Events
- TIX-015 now adds universal tournament addressing: stable `seasonId + eventId` tournament links open tournament homes from Calendar, Portal, match hubs, Player Profile history, Save Manager, and safely addressable report/event surfaces while missing ids remain plain text
- TIX-017A now completes the tournament universe after managed-player elimination, quick-sims only missing non-managed matches, preserves played results, writes sourced universe match records, awards non-managed ranking points from final bracket placements, and keeps legacy archive fallbacks safe
- TIX-017B now surfaces the completed tournament universe on tournament homes and archives: champion/runner-up truth, managed-player result context, bracket or reconstructed match-record evidence, ranking-ledger notes, and honest legacy fallback states without changing tournament simulation or player-profile selectors
- TIX-016 now renames the top-level career planning surface to `Schedule`, preserves the old chronological commitment list under `Timeline`, and adds a confirmed month-grid `Calendar` that hides future knockout rounds until the managed athlete qualifies
- TIX-019 now makes Player Profile Career records universe-wide: W-L, win percentage, titles, runner-up finishes, finals, head-to-head leaders, and optional managed-player spotlights derive from recorded `career.matchHistory` and `career.playerAchievements` rather than managed-player-only slices or bracket snapshots
- TIX-021 added the autonomous universe simulation contract: `career.universeEvents`, deterministic non-entered event completion, idempotent match/ranking/achievement writes, load/day-advance simulation, and tournament homes/Past Events fed by universe records while preserving managed-match immutability; its save version `10` shape is now superseded by TIX-023 version `11` saves
- TIX-018 now mediates the sidebar schedule rail by removing the duplicated sidebar brand/player identity block, ordering commands around the requested Core/Program/Match/Operations/System flow, marking `Inbox Preview` as disabled preview-only, and routing `Timeline`/`Calendar` commands into the `Schedule` subtabs
- TIX-022 now turns documentation into maintenance infrastructure with a true `docs/README.md` map, durable mechanics/code/save/workflow references, refreshed architecture overview, compact `AGENTS.md` documentation discipline, and ADR-003
- TIX-023 replaces static ranking points with deterministic bootstrap ranking results, rolling 52-week/best-10 snapshots, version `11` / career `9` migration, and rank-seeded event fields with non-entry and alternates.
- Version Two preparation work advances persistence to version `12` / career `10`, adds exact pending training snapshots and honest development baselines, and resolves one current-day block through the same deterministic day pipeline used by advance-day forecasts.
- Version Two schedule work now gives Portal, Timeline, and Calendar one deterministic manager diary for confirmed events, preparation, active medical returns, committed travel, scouting, and facility work, with semantic navigation and four-width browser proof.
- the frontend now has an imagegen-guided court-console redesign layer across launch, athlete selection, career shell, Portal, Calendar, Rankings, Squad, Player Profile, Live Match, and Save Manager surfaces, with a compact brand lockup, calmer court-line atmosphere, tighter management cards/tables, and updated bounded-viewport proof
- Version Two tactical fidelity now snapshots exact career sliders, rally intent, and modules into live/save match input; a shared bounded resolver drives detailed and quick match shape, live plan/module evidence, and state-derived projections while legacy tactics retain a neutral compatibility path

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
- [x] integrated the fictional calendar/ranking domain data into Career Home and Calendar UI copy
- [x] remediated the public tier-label boundary by replacing active runtime/docs/tests with fictional Circuit labels and preserving legacy save compatibility
- [x] fictionalized the active quick-tournament event name and normalized legacy tournament saves during load/import
- [x] updated release/status docs for first-launch, Save Manager, career route reachability, fictional calendar/ranking, import validation, and Phase 4 residual polish decisions
- [x] added red-first UIUX1Change regression coverage for locked career athlete identity, non-final career tournament continuation, loss/title completion, save compatibility, and deterministic post-match-to-next-round Playwright proof
- [x] fixed the career post-match state flow so a non-final managed win preserves the tournament, active event, and next opponent briefing until elimination or title
- [x] hardened tournament continuation helpers, post-match CTA branches, final-placement reward settlement, save/import round-trips, and deterministic reload proof for next-round, loss, and title closeout states
- [x] replaced the clean-launch athlete-directory loop with a direct Start Screen plus explicit career-athlete lock confirmation, while preserving Quick Tournament editability and active-career squad/profile inspection
- [x] remediated the active-career Quick Tournament draft path so draft athlete selection no longer mutates or no-ops against the locked career identity before replacement confirmation
- [x] replaced the divergent career confirmation dialog and full-page quick setup with a shared blocking playstyle-first athlete selection modal, explicit athlete-pick gating, full-roster browse fallback, and compact quick-run tactic selection
- [x] standardized the management shell around a minimal top status bar, grouped primary command sidebar, page canvas, and overlay host while preserving Save Manager, Settings, locked identity, and tournament continuation reachability
- [x] remediated Settings and confirmation overlay keyboard behavior with initial focus, focus containment, safe Escape handling, focus restoration, and focused Playwright proof
- [x] converted the active Portal, training, calendar/competition, tactics, live match, post-match review, and Save Manager surfaces toward compact management-page contracts with focused Playwright coverage
- [x] moved normal-stage career day advancement to the persistent topbar CTA and removed the Calendar special header-level Advance Day button
- [x] renamed the Calendar runtime UI, added Upcoming/Past Events subnavigation, and rebuilt the Calendar content into a full-page schedule-led layout without touching scheduling or history persistence
- [x] extracted the bracket tree into a reusable component and rendered it in career pre-match and post-match event hubs
- [x] rebuilt the live Match Command Center into a horizontal scoreboard/action/feed/viewer/telemetry/options command surface with focused unit and Playwright viewport coverage
- [x] implemented TIX-002 presentation polish for the Rally Pattern Map, compact broadcast scoreboard, folded status/action context, and deterministic Finish Set control
- [x] added the Rescue MVP Plan 1 schedule-aware career calendar foundation with direct store guards, `between_rounds`, event-history recording, save migration, and catalog invariant coverage
- [x] implemented the Rescue MVP Plan 2 daily-action resolver, scheduled-match route, red/green topbar routing, playable entered-event Calendar actions, and explicit athlete selection gate coverage
- [x] implemented Rescue MVP Plan 3 calendar, event-entry, shell cleanup, event catalog, event-details routing, and standalone start-screen fixes with unit and Playwright proof
- [x] rebuilt the Career Portal dashboard into a compact one-page command center with focused desktop/mobile bounded-layout e2e proof
- [x] filed Rescue MVP tickets as GitHub issues #10, #11, and #12, delivered them through PRs #13, #14, and #15, and archived the ticket specs under `docs/rescue_MVP/arc_tix/`
- [x] promoted the active documentation target to `v0.3 Stable Career System`
- [x] aligned the root `README.md` with the `v0.3` documentation harness and current local-first career loop
- [x] filed Rescue MVP tickets as GitHub issues #17, #18, and #19, delivered them through PRs #20, #22, and #21, and archived the ticket specs under `docs/rescue_MVP/arc_tix/`
- [x] converted the live match scoreboard to BWF-style set columns with focused unit and Playwright coverage
- [x] polished the Start Screen hierarchy and committed desktop/mobile visual QA artifacts for empty, active career, active quick tournament, and recovery states
- [x] completed the TIX-007 Start Screen visual hierarchy pass with saved-slot primary action emphasis, simplified start/manage grouping, badminton court-line atmosphere, focused unit/e2e coverage, and refreshed TIX-007 screenshots
- [x] rebalanced detailed match score shape with focused legality/low-score-prevention tests plus a 10-seed asserted calibration sweep
- [x] removed the legacy permanent competition sidebar route so Calendar handles event browsing and Live Match owns pre-match, bracket, and live command-center access
- [x] implemented TIX-011 Rankings as a career command surface with `career.rankings` table data, managed-athlete highlight plus text label, profile navigation, focused unit coverage, and desktop/mobile visual QA artifacts
- [x] implemented TIX-009 universal player addressing with stable-id profile links across setup, career hubs, live match, bracket, scouting, post-match, and prose surfaces
- [x] implemented TIX-008 universal tournament homes with Calendar `Open Event`, Past Events archive navigation, active/archived bracket rendering, and old-save fallback behavior
- [x] implemented TIX-013 player career history with persisted match records, champion/runner-up achievements, Career tab record cards, profile-linked head-to-head tables, migration defaults, and focused selector/store/UI coverage
- [x] implemented TIX-014 Calendar View commitments with date blocks, opponent profile links, event-home actions, TBD handling, and focused selector/UI tests
- [x] implemented TIX-015 universal tournament addressing with a tournament navigation provider, reusable tournament links, stable-id event-name navigation, plain-text fallbacks, and focused provider/Calendar/Past/Profile coverage
- [x] implemented TIX-017A tournament universe simulation and persistence foundation with post-elimination bracket completion, sourced match records, non-managed ranking awards, completed bracket snapshots, and legacy-safe source fallbacks
- [x] implemented TIX-017B tournament-home/archive presentation for complete event outcomes, including non-managed champion/runner-up display, managed result side-by-side context, bracket/reconstructed evidence, ranking truth notes, and non-fabricating legacy fallbacks
- [x] implemented TIX-016 Schedule hub separation with Upcoming, Past Events, Timeline, and confirmed month-grid Calendar tabs
- [x] implemented TIX-019 universe-wide player career records with non-managed H2H support, finals counts, managed-player spotlight context, old-save empty states, and duplicate-safe selector coverage
- [x] implemented TIX-021 autonomous universe simulation with completed skipped events, universe event persistence, ranking/achievement settlement, save migration safety, and route-facing archive consumption
- [x] implemented TIX-018 sidebar schedule rail mediation with a pure navigation sidebar, disabled Inbox Preview, and Timeline/Calendar shortcuts into the Schedule split
- [x] established the TIX-022 documentation system and maintainer harness with linked subsystem references, save/persistence invariants, source-structure guidance, maintainer workflow rules, and ADR-003
- [x] implemented TIX-027 Tournament Page Optimization with draw-first Tournament Home ordering, collapsed event notes, compact two-row bracket score cells, deterministic abbreviation/collision handling, selected-match detail, and 32-ready bracket layout coverage
- [x] implemented the imagegen-guided frontend rework as a shared court-console visual system, including shell/topbar markup, global styling, responsive dense-page constraints, updated unit/e2e expectations, and desktop/mobile screenshot proof
- [x] implemented the first Version Two tactical-fidelity slice with exact intent snapshots, module-specific court/shot evidence, same-category slider effects, team-talk compatibility, mid-match save round trips, calibration proof, and live Match Command Center plan markers

## In Progress

- [ ] tune balance and upset frequency
- [ ] calibrate quick mode against detailed mode across wider seeded matchup bands
- [ ] reduce detailed-mode certainty in `5+` OVR buckets without flattening elite player identity
- [ ] improve detailed-mode counterattack conversion for high-speed archetypes
- [ ] tune expanded-roster special-archetype balance against the ordinary fictional field
- [ ] improve commentary variety and phrasing
- [ ] expand post-match stats and scouting reads
- [ ] polish responsive behavior and visual details across the new shell
- [ ] deepen Past Events archive fidelity for saves created before bracket snapshots; current fallback remains summary-only by design
- [ ] track dense live-match directive labels as non-blocking polish debt; current proof does not require a Phase 4 source change
- [ ] complete the broader Phase 5 screenshot matrix and visual review beyond the focused builder proof
- [ ] run a manual playtest of the full Rescue MVP Plan 3 loop from explicit athlete selection through multi-event entry, event details, red match action, post-match review, next-day round spacing, Past Events movement, and the next due event

## Next

- [ ] add seeded batch calibration checks for quick versus detailed simulation parity
- [ ] tune quick and detailed three-game rates, average points, and rally-length distributions toward closer parity
- [ ] stage detailed rally cap testing through `48`, and then `70`
- [ ] add optional calibration assertions behind `MATCH_BALANCE_ASSERT=1`
- [ ] add optional stat-composition assertions behind `STAT_COMPOSITION_ASSERT=1`
- [ ] keep `docs/product/versions/v0.3/v0.3.md` as the active stable career-system packet while algorithm tuning continues against the `v0.2.3` baseline
- [ ] use `docs/product/versions/v0.2.4/v0.2.4.md` and `docs/product/versions/v0.2.4/player-profile-and-shell-amendment.md` as completed bridge references for UI framework, player profile, shell, and settings behavior
- [ ] keep Phase 4 shell standardization separate from the accepted Phase 3 Start Screen and locked-athlete slice
- [ ] decide whether a post-`v0.3` release should keep internal SPA page state or introduce URL routes
- [ ] confirm whether the future `32` selectable items should be called games, events, competitions, or tournaments in player-facing UI
- [ ] deepen the tactical intel layer with richer contextual explanations
- [ ] add more differentiated live directives and opponent pattern reads
- [ ] tighten save migration coverage for future `v0.2.x` changes
- [ ] tune Phase 1 career economy values, event tier rewards, and training load numbers after review feedback
- [ ] consider a compact mobile Calendar layout after final release packaging, without reopening the accepted Phase 3 reachability proof
- [ ] run the Phase 5 QC screenshot matrix and visual review against Portal, dense page, post-match, final closeout, and Save Manager states at the required viewports

## Blockers

There are no hard technical blockers right now.

Current design questions that could affect scope:

- how aggressively to tune upset frequency before expanding the manager loop
- what calibration bands should align quick background outcomes with detailed match outcomes
- how much tactical explanation belongs in the persistent `TACTICAL_INTEL` surface versus local screen copy
- how much save migration coverage is needed before future `v0.2.x` changes become risky
- how much of the richer active-match algorithm should ship before quick simulation calibration is considered good enough
- whether a post-`v0.3` release should adopt URL routes or keep a typed internal page registry inside the current SPA shell
- whether the first calendar should use fixed fictional dates or seed-generated dates
- how much the full player profile should deepen beyond the current page content versus remain focused around later season/career scaffolds
- whether future evidence packages should require walkthrough video in addition to the current screenshot, command, reset, and import proof

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
- `docs/product/versions/v0.3/v0.3.md`
- `docs/product/versions/v0.2.4/v0.2.4.md`
- `docs/product/versions/v0.2.4/player-profile-and-shell-amendment.md`
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
