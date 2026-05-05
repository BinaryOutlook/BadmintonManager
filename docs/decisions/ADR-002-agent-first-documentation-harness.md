# ADR-002: Adopt an agent-first documentation harness

## Status

Accepted

## Date

2026-04-28

## Context

Badminton Manager is built through repeated human and AI-assisted development sessions.

The previous documentation approach centered most orientation in `README.md`, with deeper context spread across top-level `PRDs/` and broad `docs/` files. That worked for early project shaping, but it made future sessions pay a larger re-entry cost:

- the README mixed product narrative, setup, architecture, current status, and contribution guidance
- version packets lived outside the main `docs/` map
- there was no compact agent-specific entrypoint
- current status, stable product truth, and release-specific scope were easy to confuse

Fast agent I/O needs small entrypoints, stable source-of-truth lanes, and links to deeper context.

## Decision

Adopt an agent-first documentation harness:

- create `AGENTS.md` as the compact routing file for AI agents and returning maintainers
- keep `README.md` as a short human landing page with setup, commands, and doc pointers
- create `docs/README.md` as the documentation map and update contract
- move stable product direction to `docs/product/PRD.md`
- move versioned release packets to `docs/product/versions/vX.Y/`
- move architecture overview to `docs/architecture/overview.md`
- move current execution state to `docs/plans/active/project-status.md`
- keep subsystem references in `docs/reference/`
- keep ADRs in `docs/decisions/`

The intended reading path is:

```text
AGENTS.md -> docs/README.md -> focused source-of-truth doc -> code/tests
```

## Alternatives Considered

### Keep the README-centered approach

Pros:

- minimal churn
- familiar to contributors

Cons:

- README would continue growing into a mixed manual
- agents would need to load too much context before acting
- status, architecture, and version scope would remain less clearly separated

Rejected because it optimizes for early browsing, not repeated implementation sessions.

### Keep `PRDs/` as a top-level folder

Pros:

- explicit product-document location
- avoids path changes for existing version packets

Cons:

- creates a second documentation root
- makes the project map less discoverable from `docs/README.md`
- weakens the idea that the repo has one documentation harness

Rejected in favor of placing versioned packets under `docs/product/versions/`.

### Put all instructions directly in `AGENTS.md`

Pros:

- one file for agents to read
- fast for tiny repos

Cons:

- easy to bloat
- repeats context already captured elsewhere
- raises stale-document risk
- crowds out task-specific context

Rejected because `AGENTS.md` should route agents, not become the whole manual.

## Consequences

Positive consequences:

- future sessions have a clear entrypoint
- docs are versioned inside the repo under one discoverable map
- active work, product truth, and architecture rules are easier to distinguish
- agents can load narrower context for most tasks

Trade-offs:

- existing path references had to be updated
- future contributors must learn the source-of-truth lanes
- docs must be kept disciplined so the harness does not decay into another mixed pile

## Follow-Up Rules

- Keep `AGENTS.md` compact.
- Update `docs/README.md` when documentation lanes change.
- Add a new ADR if the documentation model changes again.
- Move completed execution plans from `docs/plans/active/` to `docs/plans/completed/` when that archive becomes necessary.
