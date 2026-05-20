# ADR-003: Treat documentation as maintenance infrastructure

## Status

Accepted

## Date

2026-05-20

## Context

Badminton Manager has grown from a small local-first prototype into a layered management simulation.

The current system includes:

- deterministic detailed and quick match simulation
- 16-player tournaments with background quick simulation
- a stable career loop with calendar, event entry, rankings, training, recovery, economy, and program systems
- universe match records, event histories, player achievements, and profile selectors
- local save import/export, migration, quarantine, and recovery behavior
- route-like SPA pages, reusable UI surfaces, and active/historical ticket archives

Earlier documentation captured useful context, but too much knowledge lived across release packets, ticket specs, old plans, and source-code archaeology. That creates a re-entry problem for both humans and agents:

$$
\text{large system} - \text{clear documentation ownership}
= \text{blind-box development}
$$

The project needs documentation that describes current contracts, not only past delivery history.

## Decision

Badminton Manager treats documentation as part of the engineering contract.

Material system changes must update the smallest relevant durable document in the same work session. The documentation map in `docs/README.md` owns routing, and `AGENTS.md` tells agents to treat documentation upkeep as normal engineering work.

New durable references are accepted for:

- game mechanics and player/system boundaries
- source-tree and module ownership
- save and persistence invariants
- maintainer workflow

Architecture boundaries remain in `docs/architecture/overview.md`, and costly-to-reverse decisions remain in `docs/decisions/` as ADRs.

## Alternatives Considered

### Keep relying on release packets and ticket archives

Pros:

- no new documentation structure
- preserves detailed chronological context

Cons:

- current truth is hard to distinguish from historical delivery notes
- contributors must read too much before making a safe change
- agents can accidentally treat old ticket text as live architecture

Rejected because historical context is not a durable subsystem contract.

### Put the full manual in `AGENTS.md`

Pros:

- agents see everything immediately
- fewer links to follow

Cons:

- `AGENTS.md` becomes too long to read every session
- details go stale quickly
- routing and contracts become mixed together

Rejected because `AGENTS.md` should stay a compact entrypoint.

### Depend on code inspection alone

Pros:

- implementation remains the final truth
- avoids documentation overhead

Cons:

- code shows what, not why
- save, career, ranking, and tournament invariants are distributed across modules and tests
- future maintainers must rediscover boundaries repeatedly

Rejected because the system is now too large for chat-transcript memory and archaeological reading as the default workflow.

## Consequences

Positive consequences:

- humans and agents have stable re-entry points
- subsystem contracts can evolve with code instead of hiding in old tickets
- reviewers can check documentation ownership as part of code review
- architecture and save boundaries are harder to change casually
- ADRs remain the place for expensive decisions rather than scattering rationale through comments

Trade-offs:

- implementation sessions must budget time for documentation updates
- maintainers must keep references concise so they remain readable
- stale documentation is now a process failure, not harmless debris

## Follow-Up Rules

- Update `docs/README.md` when documentation lanes change.
- Keep `AGENTS.md` compact and link deeper context instead of expanding it into a manual.
- Update the matching `docs/reference/` file when gameplay, simulation, tournament, career, ranking, selector, or save contracts change.
- Update `docs/architecture/overview.md` when module ownership or runtime boundaries change.
- Add or supersede ADRs when decisions become expensive to reverse.
