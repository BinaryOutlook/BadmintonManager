# ADR-001: Use a local-first React and Vite stack for the MVP

## Status

Accepted

## Date

2026-04-22

## Context

**Badminton Manager** needs a technical foundation for a browser-based sports management simulation.

Key requirements:

- fast iteration for a solo developer
- low setup friction
- a deterministic match engine that can be tested outside the UI
- no mandatory backend for the MVP
- documentation and structure that support future re-entry

The main project risk is not deployment complexity.

The main project risk is simulation design complexity and scope creep.

## Decision

Use a local-first browser application built with:

- `React`
- `TypeScript`
- `Vite`
- `Zustand`
- `Zod`
- `Vitest`
- `Playwright`

Persistence for the MVP will stay browser-local.

The simulation engine will live in a pure TypeScript boundary that does not depend on React.

## Alternatives Considered

### Option B: Next.js full-stack app

Pros:

- one framework for UI plus backend-style routes
- easier future path toward cloud saves and richer server features

Cons:

- more framework complexity up front
- greater risk of spending early effort on app architecture instead of simulation quality

Rejected for now:

- a good long-term option, but heavier than the MVP needs

### Option C: Separate client and server apps

Pros:

- cleanest long-term architectural separation
- strongest foundation for future multiplayer or backend-heavy features

Cons:

- highest setup cost
- easiest path to overbuilding the project before gameplay is proven

Rejected for now:

- too expensive for the current phase

## Consequences

Positive consequences:

- the project can focus on the match engine immediately
- local development remains simple
- the codebase can stay small while the product thesis is still forming
- deterministic testing becomes easier

Trade-offs:

- if the game later needs cloud saves or a production database, a later architecture step will be required
- some future extraction work may be needed if the app grows beyond local-first assumptions

## Follow-Up Decisions

Related future ADRs should cover:

- simulation boundary and module ownership
- persistence model and save versioning
- long-term content organization
