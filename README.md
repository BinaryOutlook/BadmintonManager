# Badminton Manager

**Badminton Manager** is a local-first browser simulation game about coaching and managing badminton instead of directly playing it.

The player acts as the coach and match desk: selecting athletes, scouting opponents, choosing tactics, managing live match decisions, and reviewing the run afterward. The UI presents the decision surface; the deterministic simulation engine decides outcomes.

```text
select athlete -> scout opponent -> choose tactic -> manage live match -> review run
```

The first screen offers both local paths:

```text
Quick Tournament -> disposable seeded knockout run
Start Career     -> locked-athlete local coaching program
```

Use the Save Manager to continue a career, export the active JSON save, import a validated save with preview/confirm, delete the active local slot, or clear a quarantined corrupt backup. The active browser keys remain `badminton-manager-save` and `badminton-manager-save-corrupt`.

Once a career is loaded, the Career Command Center becomes the operations hub. Training, Calendar, Match Planning, Live Match, Post-Match Review, Save Manager, and New Session controls are reachable from the command shell and page actions. The Calendar surfaces fictional circuit tiers, entry deadlines, eligibility gates, ranking cutoffs, seed snapshots, draw milestones, points, prize, cost, readiness, and season-race stakes while keeping rankings and seeding as simplified presentation models.

## Quick Start

Requirements:

- `Node.js`
- `npm`

Run the project:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite dev server |
| `npm run build` | Typecheck and build the production bundle |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run test` | Run Vitest unit and integration tests |
| `npm run test:e2e` | Run Playwright browser smoke tests |

## Project Shape

```text
app/              top-level app composition
components/       UI screens and reusable surfaces
game/
  career/         local-first career calendar, rankings, economy, and hubs
  core/           deterministic match engine
  tournament/     bracket, scouting, and recap flow
  store/          Zustand state and local persistence
  content/        seeded players, tactics, and labels
  commentary/     readable feed text from engine events
docs/             product, architecture, plans, references
tests/            Vitest coverage
e2e/              Playwright coverage
```

The main architectural invariant is:

$$
\text{UI} = \text{presentation} + \text{intent}; \quad \text{engine} = \text{outcomes}
$$

## Current Version

Current runnable target: `v0.3 Stable Career System`, layered on the completed `v0.2.4`
UI/career/save bridge and the `v0.2.3` match-algorithm baseline.

`v0.3` stabilizes the local-first career loop: career launch, locked managed athlete, dense Career
Command Center, training/recovery, calendar entry, scheduled match days, live match management,
post-match review, rankings, budget ledger, and Save Manager trust surfaces.

## Documentation

This repo now uses an agent-first documentation harness:

- `AGENTS.md` - compact entrypoint for AI agents and future coding sessions
- `docs/README.md` - documentation map and update rules
- `docs/product/PRD.md` - stable product direction
- `docs/product/versions/` - versioned release packets and UI references
- `docs/product/versions/v0.3/v0.3.md` - active stable career-system release packet
- `docs/product/versions/v0.2.4/v0.2.4.md` - completed UI/career/save bridge packet
- `docs/product/versions/v0.2.3/v0.2.3.md` - completed match-algorithm baseline packet
- `docs/architecture/overview.md` - architecture and implementation boundaries
- `docs/reference/` - subsystem contracts
- `docs/plans/active/project-status.md` - current state and next work
- `docs/decisions/` - architecture decision records

Start with `AGENTS.md` if you are an AI agent or returning maintainer. Start with `docs/README.md` if you need the deeper source-of-truth map.

## Contribution Mindset

Good changes preserve the coaching fantasy and make the simulation easier to trust.

Prefer:

- deterministic, testable game logic
- readable management-sim choices
- documented product and architecture changes
- narrow iterations with clear acceptance criteria

Avoid:

- direct action or reflex gameplay
- gameplay formulas inside React components
- fake telemetry that is not derived from engine state
- backend or live-service scope before the local-first loop needs it
