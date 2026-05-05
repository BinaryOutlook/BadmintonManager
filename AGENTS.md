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
4. `docs/product/versions/v0.2.3/v0.2.3.md` - active release packet
5. `docs/architecture/overview.md` - architecture boundaries and commands
6. `docs/reference/` - subsystem contracts for match engine, player model, tactics, and tournament flow

## Architecture Rules

- Keep simulation logic outside React components.
- Preserve deterministic outputs for identical seeds, players, tactics, and choices.
- Treat UI as presentation plus player intent; outcome resolution belongs in `src/game/core/`.
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

## Documentation Update Rules

- Product behavior or scope change: update `docs/product/PRD.md` or the active version packet.
- Architecture boundary change: update `docs/architecture/overview.md`; add an ADR in `docs/decisions/` when the decision is expensive to reverse.
- Subsystem rule change: update the matching file in `docs/reference/`.
- Project state change: update `docs/plans/active/project-status.md`.
- New release target: create `docs/product/versions/vX.Y/` or `docs/product/versions/vX.Y.Z/`.

Do not let `AGENTS.md` become a large manual. Its job is fast routing.

## Ask First

Ask before:

- adding a backend, auth, database, or cloud save requirement
- changing the persistence model materially
- replacing the state library or UI framework
- adding direct action controls
- introducing real athlete likenesses or licensed content
