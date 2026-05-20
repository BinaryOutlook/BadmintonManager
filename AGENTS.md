# AGENTS.md

This file is the compact agent entrypoint for **Badminton Manager**. Keep it short; link deeper context instead of pasting long policy or product prose here.

## Mission

Build a local-first badminton management simulation where the player is the coach, not the athlete.

Core loop:

```text
select athlete -> scout opponent -> choose tactic -> manage live match -> review run
```

## Read First

Use progressive disclosure. Read only what the task needs.

1. `docs/README.md` - documentation map and update rules
2. `docs/plans/active/project-status.md` - current phase, completed work, next work
3. `docs/product/PRD.md` - stable product truth
4. `docs/product/versions/v0.3/v0.3.md` - active stable career-system release packet
5. `docs/product/versions/v0.2.4/v0.2.4.md` - completed UI/career/save bridge packet
6. `docs/product/versions/v0.2.3/v0.2.3.md` - match-algorithm baseline packet
7. `docs/architecture/overview.md` - architecture boundaries and commands
8. `docs/reference/` - subsystem contracts for mechanics, code structure, match engine, career flow, saves, tournaments, player model, and tactics

## Architecture Rules

- Keep simulation logic outside React components.
- Preserve deterministic outputs for identical seeds, players, tactics, and choices.
- Treat UI as presentation plus player intent; outcome resolution belongs in `game/core/`.
- Keep local persistence versioned and validated.
- Make telemetry and commentary explain real engine state, not decorative fiction.

The core boundary is:

$$
\text{React UI} \rightarrow \text{intent} \rightarrow \text{game engine} \rightarrow \text{state + events}
$$

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build |
| `npm run typecheck` | TypeScript validation |
| `npm run test` | Vitest tests |
| `npm run test:e2e` | Playwright browser tests |

## Documentation Discipline

Use `docs/README.md` as the documentation map. When a system changes materially, update the smallest durable doc that lets the next maintainer understand it without the chat transcript.

- Gameplay, simulation, tournament, ranking, or career-rule change: update the matching `docs/reference/` file.
- Architecture boundary, route/page structure, or module-ownership change: update `docs/architecture/overview.md`.
- Save schema, migration, import/export, or local-persistence behavior change: update `docs/reference/save-and-persistence.md`.
- Product behavior or scope change: update `docs/product/PRD.md` or the active version packet.
- Setup, command, public data contract, or verification change: update `README.md`, this file, or `docs/README.md`.
- Expensive-to-reverse decision: add or supersede an ADR in `docs/decisions/`.

Do not let `AGENTS.md` become a large manual. Its job is fast routing.

## Ask First

Ask before:

- adding a backend, auth, database, or cloud save requirement
- changing the persistence model materially
- replacing the state library or UI framework
- adding direct action controls
- introducing real athlete likenesses or licensed content
