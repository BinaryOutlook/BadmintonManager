# Technical Brief: Badminton Manager

## High Concept

**Badminton Manager** is a local-first browser simulation game built around a deterministic singles match engine and a lightweight management shell.

The player does not directly control rallies.

The system simulates them from:

- player ratings
- tactics
- stamina
- pressure
- seeded randomness

The technical goal is to make the simulation trustworthy, inspectable, and easy to extend before the UI becomes elaborate.

## Chosen Technical Direction

This project adopts **Option A**, the local-first SPA path.

Selected stack:

- `React`
- `TypeScript`
- `Vite`
- `Zustand`
- `Zod`
- `Vitest`
- `Playwright`

Planned persistence approach:

- small settings in browser storage
- tournament and run saves in browser storage first
- no required backend for the MVP

## Why This Stack

This stack is chosen because the current product risk is simulation complexity, not infrastructure complexity.

We want:

- low setup friction
- fast local iteration
- a clear separation between UI and engine
- easy testing of pure game logic

We do not want the project to stall on:

- server deployment
- auth
- API design
- database operations

## Design Stance

The correct first architecture is not the most scalable possible architecture.

The correct first architecture is the one that makes it easiest to:

- prove the match engine works
- tune the simulation
- inspect deterministic outputs
- preserve maintainability

The browser app should remain the shell around a pure simulation boundary.

## Planned Project Shape

```text
docs/
  decisions/
  reference/
PRDs/
  v0.1/
src/
  app/
  components/
  game/
    content/
    core/
    store/
    commentary/
    tournament/
  lib/
tests/
  unit/
  integration/
e2e/
```

### Directory intent

- `src/app/`: route-level screens and top-level composition
- `src/components/`: reusable UI surfaces
- `src/game/core/`: pure simulation logic with no React imports
- `src/game/content/`: player seeds, tactic presets, commentary templates
- `src/game/store/`: Zustand state and UI-facing actions
- `src/game/commentary/`: transforming engine events into readable match text
- `src/game/tournament/`: bracket setup and advancement helpers
- `src/lib/`: small shared utilities such as RNG helpers or schema helpers
- `tests/unit/`: pure logic tests
- `tests/integration/`: state and feature-path tests
- `e2e/`: browser tests

## Runtime Boundaries

The project should maintain four clean layers.

### 1. Simulation core

The simulation core owns:

- player rating interpretation
- rally and point resolution
- set and match progression
- fatigue and pressure modifiers
- seeded RNG consumption

This layer must be:

- deterministic
- pure or near-pure
- testable without React

### 2. Game application state

The application state owns:

- the selected player
- tournament progress
- chosen tactics
- current match presentation state
- save and load orchestration

This layer may use Zustand.

### 3. Presentation layer

The UI owns:

- bracket screens
- player cards
- commentary feed
- match score presentation
- tactic selection controls

This layer must never decide who wins a rally.

### 4. Persistence layer

The persistence layer owns:

- serializing app state
- validating hydrated saves
- versioning save payloads

The persistence layer must not contain gameplay formulas.

## Match Simulation Model

The match engine should use a **risk and reward event model**, not a physics engine.

Core shape:

```ts
interface MatchSimulationInput {
  seed: number;
  playerA: Player;
  playerB: Player;
  tacticsA: MatchTactic;
  tacticsB: MatchTactic;
}
```

Engine output should contain:

- final score
- set-by-set results
- event log
- derived stats
- explanation-friendly point history

The event log should be machine-readable first and rendered into commentary later.

## Resolution Order

The planned simulation pipeline is:

1. initialize match state from players, tactics, and seed
2. initialize the current set
3. initialize the current rally from server and score context
4. choose shot intent for the active player
5. calculate shot execution and target difficulty
6. resolve in, out, or net outcomes
7. if live, resolve judgment and retrieval for the defender
8. continue until the rally ends
9. update score, stamina, pressure, and serving state
10. repeat until set and match completion

This order should be documented and preserved in tests.

## Data Modeling Direction

The initial data model should stay small and explicit.

Planned core entities:

- `Player`
- `PlayerRatings`
- `MatchTactic`
- `TeamTalk`
- `Tournament`
- `MatchResult`
- `MatchEvent`
- `SaveState`

Content should begin as typed local data files, not a database schema.

## Persistence Strategy

The MVP is local-first.

Initial persistence rules:

- use browser storage for settings and the current tournament run
- validate saves with Zod before hydration
- include an explicit save version
- keep saves portable JSON-shaped data

The project should not adopt a backend or production database unless a later version clearly requires one.

## Testing Strategy

This project should treat the simulation as the primary testing target.

### Unit tests

Use `Vitest` for:

- RNG determinism
- derived stat calculations
- rally resolution rules
- set and match scoring
- fatigue and pressure modifiers
- bracket progression

### Integration tests

Use `Vitest` for:

- store plus simulation interactions
- persistence round-trips
- tactic selection to match result flows

### End-to-end tests

Use `Playwright` for:

- loading the app
- creating or loading a tournament run
- starting a match
- progressing through a completed match and bracket state

## Planned Commands

These are the intended project commands once the app scaffold exists:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

## Boundaries

Always do:

- keep simulation logic outside React components
- keep engine output deterministic for a given seed
- write tests for simulation changes
- update docs when system boundaries change

Ask first:

- adding a backend
- changing the persistence model materially
- swapping the state library
- expanding the MVP beyond singles and one tournament loop

Never do:

- put gameplay formulas in UI components
- make the first version depend on remote services
- hide important simulation rules in untyped ad hoc objects
- treat commentary strings as the source of truth for match outcomes

## Near-Term Implementation Order

1. scaffold the Vite React TypeScript app
2. define player and tactic schemas
3. implement seeded RNG helpers
4. implement rally, set, and match simulation
5. seed 16 players and bracket logic
6. present commentary and score in the browser
7. add save and resume support

## Technical Success Criteria

The foundation is technically healthy when:

- the app runs locally with minimal setup
- the engine is testable outside React
- match results are reproducible from a seed
- the UI reads engine output rather than generating game truth
- save payloads are versioned and validated
