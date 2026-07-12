# Architecture Overview: Badminton Manager

## High Concept

**Badminton Manager** is a local-first browser management simulation. The player acts as coach and program manager; deterministic TypeScript game modules resolve match, tournament, career, ranking, and save outcomes.

The core runtime boundary is:

$$
\text{React UI}
\rightarrow \text{player intent}
\rightarrow \text{Zustand actions}
\rightarrow \text{game modules}
\rightarrow \text{state, events, records, saves, presentation}
$$

React renders decisions and evidence. Game modules decide outcomes.

## Current Technical Direction

The project uses the local-first SPA path accepted in `docs/decisions/ADR-001-tech-stack.md`.

Selected stack:

- `React`
- `TypeScript`
- `Vite`
- `Zustand`
- `Zod`
- `Vitest`
- `Playwright`

There is no required backend, auth, account system, database, or cloud save for the MVP.

Persistence is browser-local and portable:

- multi-slot repository prefix: `badminton-manager-saves`
- independent slot envelopes, rolling per-slot backups, and per-slot quarantine records
- legacy singleton keys remain migration/recovery inputs only
- current top-level save version: `13`
- current career schema version: `11`
- import path: parse -> validate -> migrate -> preview -> create a new slot

Version `13` / career `11` adds season-qualified event editions, durable season reviews, and explicit rollover to the
version-12 preparation/development contract. `game/store/save.ts` owns portable migration;
`game/store/saveRepository.ts` owns slot envelopes, verified writes, backups, and quarantine. React routes render the
resolved state and dispatch explicit intent; they do not manufacture lifecycle or recovery outcomes.

See `docs/reference/save-and-persistence.md` for the persistence contract.

## Project Shape

```text
AGENTS.md
README.md
docs/
  README.md
  architecture/
  decisions/
  product/
  plans/
  reference/
  active_tix/
  arc_tix/
app/
  App.tsx
  pages.ts
  playerNavigation.tsx
  tournamentNavigation.tsx
  pages/
components/
game/
  career/
  commentary/
  content/
  core/
  selectors/
  store/
  tournament/
tests/
  unit/
  calibration/
e2e/
```

For a practical file-by-file source map, see `docs/reference/code-structure.md`.

## Runtime Layers

### 1. App And Page Shell

Owned primarily by `app/App.tsx` and `app/pages.ts`.

Responsibilities:

- internal SPA page registry through typed `AppPage` state
- launch shell versus command shell selection
- top status bar, primary command sidebar, page canvas, and overlay host
- navigation to player profiles and tournament homes through provider helpers
- career Squad separation between My Program and the view-only World Directory; recruited athletes use a career-state
  profile while the locked lead identity remains unchanged
- dedicated Inbox and Reports routes: Inbox maps semantic destinations to owning desks, while Reports remains read-only
  and separate from the mutating post-match Review route
- route-like page rendering without a URL router
- wiring UI callbacks to Zustand store actions

The app shell may decide which page to show. It should not decide gameplay outcomes.

### 2. Presentation Components

Owned by `components/`.

Responsibilities:

- setup, Save Manager, command shell pages, live match page, bracket tree, profile links, tournament links, overlays, and career workbenches
- rendering derived state into readable management surfaces
- dispatching player intent through callbacks
- preserving accessibility and focus behavior for overlays

Large page-level components such as `components/CareerWorkbench.tsx` may organize workflows, but they should delegate rules to `game/` modules.

### 3. Store And Persistence Orchestration

Owned by `game/store/store.ts`, `game/store/save.ts`, and `game/store/saveRepository.ts`.

Responsibilities:

- Zustand runtime state
- app phase, selected player, tournament, live match, career, save-recovery flags
- state-changing actions for career, tournament, match, save, and UI-facing commands
- multi-slot autosave, switching, metadata, archive/delete, duplicate, import-to-slot, and backup restore orchestration
- Zod schemas, supported legacy save versions, migration, and import validation
- verified local envelope writes, bounded backups, per-slot quarantine, and singleton migration

The store is the bridge between UI intent and game modules. It should remain thin enough that subsystem formulas stay in `game/core/`, `game/career/`, or `game/tournament/`.

### 4. Match Engine

Owned by `game/core/`.

Responsibilities:

- deterministic player/tactic/rating models
- detailed live match sessions and point-by-point rally resolution
- quick background match simulation
- fidelity dispatch through `simulateMatchByFidelity()`
- live directives, team talks, set progression, scoring laws, stats, and summary events
- seeded RNG behavior

The current match structure is best-of-three games to `21`, win by `2`, with a `30` point cap. See `docs/reference/match-engine.md` and `docs/reference/match-simulation-fidelity.md`.

### 5. Career System

Owned by `game/career/`.

Responsibilities:

- career schemas and migration-friendly state versions
- locked managed athlete
- fictional event catalog, eligibility, deadlines, seeding snapshots, and statuses
- date advancement, daily actions, scheduled match-day guards, and round spacing
- training, recovery, injury/readiness, economy, facilities, media, scouting, recruitment, youth, staff, promises, rivals, and tactical planning
- pre-match brief creation and post-match settlement
- rankings, event histories, universe event records, match histories, player achievements, and tactical viewer evidence
- explicit season review/start boundaries plus deterministic future calendar generation
- persistent world-player snapshots, aging curves, retirement/intake, active-world rankings and fields, and durable
  lifecycle evidence through `game/career/world.ts`

Career date advancement must respect scheduled managed matches. Direct day advancement must not skip a due or overdue match. Universe progression belongs in `game/career/` services: day advancement, managed match review, and save load/import may run `simulateUniverseThroughDate()`, but React components must not simulate or fabricate tournament outcomes.

See `docs/reference/career-calendar-ranking.md` and `docs/reference/game-mechanics.md`.

### 6. Tournament System

Owned by `game/tournament/`.

Responsibilities:

- deterministic 16-player field selection from the fictional player pool
- bracket construction and current managed match context
- quick simulation for non-managed matches
- advancement after managed matches
- post-elimination completion of the remaining bracket
- champion and managed-run summaries
- legacy quick-tournament name normalization

Tournament logic must preserve completed facts and only fill missing non-managed matches. See `docs/reference/tournament-system.md`.

### 7. Content And Commentary

Owned by `game/content/` and `game/commentary/`.

Responsibilities:

- typed fictional players and tactic/directive content
- readable commentary derived from engine point and set facts

Content is local and fictional. Commentary explains engine truth; it does not own outcome truth.

### 8. Selectors And Read Models

Owned by `game/selectors/`.

Responsibilities:

- derived player profile view models
- career record cards, titles, finals, head-to-head summaries, and managed-player spotlights
- deduplication and honest old-save empty/fallback states

Selectors should read persisted universe facts such as `career.matchHistory` and `career.playerAchievements` instead of fabricating records from legacy bracket snapshots.

## Critical Data Flow

```text
player intent in React
  -> App callback
  -> Zustand action
  -> game/core, game/career, or game/tournament function
  -> updated store state
  -> persist versioned save
  -> selector/read model
  -> React presentation
```

This flow keeps game truth outside presentation and makes deterministic testing possible.

## Test Strategy

Use `Vitest` for:

- match engine determinism, scoring laws, quick/detailed behavior, directives, talks, and set progression
- tournament draw and advancement
- career calendar, due-match guards, event entry, rankings, histories, records, and program systems
- save schemas, migration, import-preview safety, corrupt-save quarantine, and legacy normalization
- selectors and React component surfaces

Use calibration tests for larger seeded sweeps:

- `npm run calibrate:match`
- `npm run calibrate:stats`

Use `Playwright` for:

- launch, setup, career start, quick tournament, active-save resume, and recovery states
- command shell and scheduled match routing
- Save Manager browser behavior
- live Match Command Center layout and flow
- post-match continuation and reload proof
- focused responsive layout guardrails

## Commands

Use these from the repository root:

```sh
npm install
npm run dev
npm run build
npm run typecheck
npm run test
npm run test:e2e
```

Issue-specific documentation checks may add `rg` searches; see `docs/reference/maintainer-workflow.md`.

## Boundaries

Always do:

- keep simulation logic outside React components
- preserve deterministic outputs for identical seeds, players, tactics, choices, and fidelity mode
- keep local persistence versioned, validated, and import-safe
- write or update tests for behavior changes
- update the smallest durable doc when boundaries, rules, schemas, routes, commands, or public contracts change

Ask first:

- adding a backend, auth, account system, database, or cloud save requirement
- changing the persistence model materially
- replacing React, Zustand, Vite, or the current local-first SPA direction
- adding direct racket controls
- introducing real athlete likenesses or licensed event content

Never do:

- put gameplay formulas in UI components
- make the MVP depend on remote services
- hide important simulation rules in untyped ad hoc objects
- treat commentary strings or historical ticket text as source of truth for outcomes

## Reference Map

- Game/system model: `docs/reference/game-mechanics.md`
- Source tree: `docs/reference/code-structure.md`
- Save contract: `docs/reference/save-and-persistence.md`
- Maintainer process: `docs/reference/maintainer-workflow.md`
- Match engine: `docs/reference/match-engine.md`
- Career calendar/ranking: `docs/reference/career-calendar-ranking.md`
- Tournament system: `docs/reference/tournament-system.md`
- Decisions: `docs/decisions/`
