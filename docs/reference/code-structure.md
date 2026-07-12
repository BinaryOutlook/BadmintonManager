# Code Structure Reference

This document maps the current source tree in practical maintainer language. Use it before changing module ownership, routing, persistence, simulation, tournament progression, or career date behavior.

Required boundary:

$$
\text{React components should render state and dispatch intent;}
\quad
\text{game modules should decide outcomes.}
$$

## Top-Level Runtime

| Path | Owns | Notes |
| --- | --- | --- |
| `main.tsx` | React bootstrap | Mounts the app into the browser document. |
| `app/` | SPA composition, page registry, navigation helpers | Keeps route-like page state without a URL router. |
| `components/` | Reusable UI surfaces and page-level workbenches | Renders state and calls callbacks from the store/app shell. |
| `game/` | Simulation, career, tournament, content, selectors, persistence orchestration | Outcome logic belongs here, not in React components. |
| `tests/unit/` | Vitest coverage for logic and React surfaces | Current test suite covers engine, store/career flows, save migration, selectors, links, and page behavior. |
| `e2e/` | Playwright browser proof | Covers launch, career loop, save trust, overlays, command shell, match center, and responsive slices. |

## `app/`

`app/` is the internal SPA shell.

- `app/App.tsx` composes the command shell, top bar, sidebar commands, overlay host, Save Manager, setup flow, and route-like page rendering.
- `app/pages.ts` defines the typed `AppPage` registry and phase-bound fallback pages.
- `app/playerNavigation.tsx` provides stable player-profile navigation by `playerId`.
- `app/tournamentNavigation.tsx` provides stable tournament-home navigation by `seasonId + eventId`.
- `app/pages/PlayerProfilePage.tsx` and `app/pages/SquadPage.tsx` render generated player-profile and squad-directory pages.

Current page state is local React state, not URL routing. If browser-history or deep-link behavior becomes necessary, update `docs/architecture/overview.md` and consider an ADR before adding a router.

## `components/`

`components/` contains reusable UI surfaces and large page-level workbenches.

Important files:

- `components/CareerWorkbench.tsx` renders the career command surfaces: Portal, Timeline, standalone month Calendar, Training, Rankings, Program Hub, Rival Programs, Facilities, Media, Scouting, Recruitment, Youth, Staff, Promises, Match Planning, Pre-Match, Post-Match, and Tournament Home.
- `components/SetupView.tsx` owns the launch screen, career-athlete selection modal, quick-tournament selection, resume summary, and recovery entry points.
- `components/SaveManagerView.tsx` owns import preview, export, active-slot deletion, corrupt-backup deletion, and save metadata presentation.
- `components/MatchView.tsx` renders the live Match Command Center and dispatches point, set, directive, talk, and advance actions.
- `components/OverviewView.tsx` and `components/CompleteView.tsx` support the quick-tournament bracket and completion surfaces.
- `components/KnockoutTree.tsx` renders reusable bracket trees for quick and career contexts.
- `components/PlayerLink.tsx` and `components/TournamentLink.tsx` keep profile/event links addressable without fabricating missing targets.
- `components/ConfirmOverlay.tsx`, `components/SettingsOverlay.tsx`, and `components/useModalFocus.ts` own modal behavior and keyboard focus safety.

UI components may calculate display labels and summaries. They should not decide match winners, ranking awards, save migration behavior, or career-day legality.

## `game/core/`

`game/core/` owns deterministic match truth and core models.

- `game/core/models.ts` defines shared Zod schemas and TypeScript types for players, tactics, sides, shot events, point/set/match results, live sessions, directives, team talks, and simulation fidelity.
- `game/core/match.ts` owns detailed live simulation, quick simulation, fidelity dispatch, scoring, rally/point progression, live directives, team talks, stats, and summary events.
- `game/core/ratings.ts` derives player profiles and modifiers from ratings, tactics, directives, team talks, and score pressure.
- `game/core/rng.ts` is the seeded RNG helper.
- `game/core/intel.ts` derives scouting, dossier, telemetry, momentum, tactic, and run summaries from core state.

Danger zone: `game/core/match.ts` changes can alter deterministic scorelines, save-shaped live sessions, tournament outcomes, calibration bands, and many tests.

## `game/career/`

`game/career/` owns the career state machine and program systems.

- `models.ts` defines career schemas, versions, stages, events, rankings, economy, health, ecosystem, rivals, tactics, facilities, media, histories, match records, achievements, and reports.
- `state.ts` creates the initial career state and locked managed-athlete career record.
- `calendar.ts`, `dailyAction.ts`, and `matchSchedule.ts` own date advancement, daily CTA resolution, due-match guards, scheduled round dates, and activation of due events.
- `events.ts` owns the fictional event catalog, deadline/status derivation, eligibility, seeding snapshots, timeline entries, confirmed calendar entries, and archive grouping helpers.
- `rankings.ts` owns rank ordering and duplicate-safe event point awards.
- `hubs.ts` builds pre-match briefs and settles career matches into rewards, reports, rankings, histories, match records, and achievements.
- `training.ts`, `health.ts`, and `economy.ts` own preparation load, injury/readiness, and budget ledger behavior.
- `development.ts` projects persisted career growth onto direct managed-match rating equivalents without mutating canonical player content.
- `ecosystem.ts`, `rivals.ts`, `tactics.ts`, and `facilitiesMedia.ts` own program depth systems and their migrations.
- `tacticalViewer.ts` derives Rally Pattern Map evidence from match results or live sessions.

Danger zone: `calendar.ts`, `dailyAction.ts`, `matchSchedule.ts`, `events.ts`, `hubs.ts`, `models.ts`, and migrations in ecosystem/tactics/facilities modules can change whether players can skip matches, duplicate rewards, break old saves, or fabricate archives.

## `game/tournament/`

`game/tournament/` owns knockout events.

- `metadata.ts` owns the fictional quick-tournament name and legacy-name normalization.
- `tournament.ts` owns entrant selection from the 47-player pool, 16-player bracket construction, managed match context, autoplay tactic selection, quick non-managed matches, missing-match fill-in, post-elimination bracket completion, champion detection, and managed-result summaries.

Danger zone: tournament advancement must preserve completed facts. Non-managed quick simulation should fill missing background matches without rerolling played managed results.

## `game/store/`

`game/store/` is the Zustand bridge between UI intent and game modules.

- `store.ts` owns app phase, selected player, active tournament, live match, career, save recovery state, local-storage keys, action methods, persistence writes, active save replacement, deletion, and corrupt-save quarantine on boot.
- `save.ts` owns persisted-save schemas, supported legacy versions, current version migration, import validation, and current-save parsing.

Danger zone: store actions are where many subsystem boundaries meet. Save schema changes must update `docs/reference/save-and-persistence.md`, migration tests, and import/export behavior.

## `game/content/`

`game/content/` is typed local content, not a database.

- `players.ts` defines the fictional player pool and `playerMap`.
- `tactics.ts` defines quick tactic presets, tactic options, and live directive options.

Fictional content boundaries matter: do not introduce real athlete likenesses or licensed event branding without explicit product direction.

## `game/commentary/`

`game/commentary/commentary.ts` turns engine point and set facts into readable text. Commentary should explain engine state; it must not become the source of truth for outcomes.

## `game/selectors/`

`game/selectors/player.ts` derives read models for player profile pages and career records.

Selector rules:

- derive from persisted match records and achievements when presenting universe career truth
- deduplicate records defensively
- do not reread legacy bracket snapshots as profile match records
- keep missing or old-save evidence honest instead of inventing history

## `tests/`

`tests/unit/` includes:

- match engine determinism, scoring, quick/detailed behavior, directives, and set progression
- tournament draw/progression boundaries
- career calendar, ranking, daily action, event flow, ecosystem, tactics, facilities, media, and tactical viewer coverage
- save migration, import-preview safety, corrupt-save quarantine, and legacy normalization
- player-profile selectors and UI pages
- launch, command shell, setup, bracket tree, links, and match view components

Calibration tests live under `tests/calibration/` and are run by dedicated npm scripts, not the normal unit suite.

## `e2e/`

Playwright proof covers browser-level behavior:

- clean launch, career start, quick tournament, and overlay focus
- active career resume and replacement confirmation
- career core loop, scheduled match routing, post-match continuation, and reload proof
- Save Manager trust surfaces
- match command center desktop/mobile layout
- mobile setup overflow guardrails

Use e2e when a UI route, overlay, launch/save flow, or command surface changes.

## TIX-023 Ranking And Event-Field Ownership

Rolling ranking and event-entry simulation ownership is split deliberately:

- `game/career/models.ts` defines `RankingResult`, ranking settings, ranking snapshot metadata, and event field snapshot schemas.
- `game/career/rankings.ts` owns pure ranking-window calculation, bootstrap prior-year ranking generation, ranking-result creation, and snapshot rebuild helpers.
- `game/career/universe.ts` owns deterministic career event fields, non-entry/dropout resolution, weighted alternates, final seeding snapshots, universe bracket completion, and idempotent ranking-result writes.
- `game/tournament/tournament.ts` can construct a playable 16-player tournament from an already-finalized career field; it does not decide career entry policy.
- `game/store/save.ts` owns version `11` / career `9` migration for rolling ranking fields and legacy ranking snapshots.
- React components may display rolling-window explanations and field-change summaries, but they must not select entrants, mutate ranking ledgers, or simulate tournament outcomes.

Danger zone: adding ranking rows without rebuilding snapshots, or completing universe events without stable ranking-result ids, can duplicate points after reload/import/day advance.
