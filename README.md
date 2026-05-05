# Badminton Manager

**Badminton Manager** is a local-first browser simulation game about managing badminton instead of directly playing it.

The player acts as the coach and match desk: selecting tactics, reading pressure, interpreting point flow, and trying to guide an athlete through a seeded singles tournament. The UI presents the match; the deterministic simulation engine decides it.

```text
coach intent -> tactics -> deterministic engine -> commentary + telemetry
```

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
src/
  app/            top-level app composition
  components/     UI screens and reusable surfaces
  game/
    core/         deterministic match engine
    tournament/   bracket, scouting, and recap flow
    store/        Zustand state and local persistence
    content/      seeded players, tactics, and labels
    commentary/   readable feed text from engine events
docs/             product, architecture, plans, references
tests/            Vitest coverage
e2e/              Playwright coverage
```

The main architectural invariant is:

$$
\text{UI} = \text{presentation} + \text{intent}; \quad \text{engine} = \text{outcomes}
$$

## Documentation

This repo now uses an agent-first documentation harness:

- `AGENTS.md` - compact entrypoint for AI agents and future coding sessions
- `docs/README.md` - documentation map and update rules
- `docs/product/PRD.md` - stable product direction
- `docs/product/versions/` - versioned release packets and UI references
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
