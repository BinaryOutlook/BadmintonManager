# Badminton Manager

**Badminton Manager** is a local-first browser simulation game about managing badminton instead of directly playing it.

The player acts as the coach and match desk: selecting tactics, reading pressure, interpreting point flow, and trying to guide an athlete through a seeded singles tournament. The UI presents the match; the deterministic simulation engine decides it.

```text
coach intent -> tactics -> deterministic engine -> commentary + telemetry
```

The first screen now offers both local paths:

```text
Start Tournament -> quick seeded knockout run
Start Career     -> single-slot local coaching program
```

Use `SAVE_MANAGER` in the command shell to continue a career, export the active JSON save, import a validated save with preview/confirm, delete the active local slot, or clear a quarantined corrupt backup. The active browser keys remain `badminton-manager-save` and `badminton-manager-save-corrupt`.

Once a career is loaded, the main canvas shows a career route strip above the workspace and Career Home acts as the management map. Training, Calendar / Event Desk, Match Planning, Live Match, Post-Match Review, Save Manager, and New Session controls are reachable from visible in-page actions instead of depending on sidebar discovery. The Calendar / Event Desk now surfaces the fictional circuit tier, entry deadline, eligibility gate, ranking cutoff, seed snapshot, draw milestone, points, prize, cost, readiness, and season-race stakes while calling out that rankings and seeding are simplified presentation models.

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

Current runnable target: `v0.2.4 UI Framework and Season-Ready Layout`, layered on the completed
`v0.2.3 Game-algorithm` baseline.

`v0.2.4` is the active UI/career/save release packet. The shipped runtime now includes the first-launch
dual path, visible single-slot Save Manager, career route map, and fictional Circuit calendar/ranking
workspace while preserving the deterministic match engine and local-first persistence model.

## Documentation

This repo now uses an agent-first documentation harness:

- `AGENTS.md` - compact entrypoint for AI agents and future coding sessions
- `docs/README.md` - documentation map and update rules
- `docs/product/PRD.md` - stable product direction
- `docs/product/versions/` - versioned release packets and UI references
- `docs/product/versions/v0.2.4/v0.2.4.md` - active UI/career/save release packet
- `docs/product/versions/v0.2.3/v0.2.3.md` - match-algorithm baseline packet
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
