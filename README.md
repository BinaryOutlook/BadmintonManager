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

Use the Save Manager to maintain multiple named local careers, switch, rename, duplicate, archive, restore rolling
checkpoints, export portable JSON, or import a validated save into a new slot. Browser slot data uses the
`badminton-manager-saves` prefix; the former `badminton-manager-save` singleton is migrated only after verified writes.

Once a career is loaded, the Career Command Center becomes the operations hub. Training, Schedule, Match Planning, Live Match, Post-Match Review, Save Manager, and New Session controls are reachable from the command shell and page actions. Schedule houses Upcoming, Past Events, Timeline, and a confirmed month-grid Calendar while keeping rankings and seeding as simplified presentation models.

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

This repo uses the agent-first documentation harness described in `docs/README.md`.
Start with `AGENTS.md` for fast routing, then use the docs map when the task needs
deeper product, architecture, or subsystem context.

| Need | Read |
| --- | --- |
| Fast session entry | `AGENTS.md` |
| Full documentation map and update rules | `docs/README.md` |
| Stable product direction | `docs/product/PRD.md` |
| Milestone sequence | `docs/product/ROADMAP.md` |
| Active release packet | `docs/product/versions/v0.3/v0.3.md` |
| Completed UI/career/save bridge | `docs/product/versions/v0.2.4/v0.2.4.md` |
| Completed match-algorithm baseline | `docs/product/versions/v0.2.3/v0.2.3.md` |
| Architecture and implementation boundaries | `docs/architecture/overview.md` |
| Subsystem contracts | `docs/reference/` |
| Match calibration references | `docs/reference/match-simulation-fidelity.md`, `docs/reference/match-balance-calibration.md`, `docs/reference/stat-composition-calibration.md` |
| Current state and next work | `docs/plans/active/project-status.md` |
| Architecture decisions | `docs/decisions/` |
| Archived Rescue MVP tickets | `docs/rescue_MVP/arc_tix/` |

When code changes materially, update the smallest doc that would let the next
maintainer or agent understand the change without needing the chat transcript.

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
