# Project Status

Status date: 2026-04-22
Current version target: `v0.1`
Overall phase: Playable tournament MVP
Chosen stack: Option A local-first SPA

## Snapshot

The project now has a runnable browser build.

What is now stable:

- the product direction is web-first
- the player fantasy is coach and manager, not athlete control
- the MVP is singles-first and tournament-first
- the technical direction is a local-first React, TypeScript, and Vite stack
- the documentation hierarchy has been established
- the deterministic match engine is implemented
- the 16-player knockout flow is implemented
- a commentary-first UI and local persistence are implemented

## Completed

- [x] stack options reviewed
- [x] Option A selected
- [x] stable PRD drafted
- [x] technical brief drafted
- [x] initial subsystem reference docs drafted
- [x] first version packet drafted
- [x] Vite React TypeScript app scaffolded
- [x] deterministic rally, set, and match engine implemented
- [x] 16-player seeded tournament flow implemented
- [x] local persistence implemented
- [x] unit tests, build verification, and browser smoke test passing

## In Progress

- [ ] tune balance and upset frequency
- [ ] improve commentary variety and phrasing
- [ ] expand post-match stats and scouting reads

## Next

- [ ] add richer match analytics and tactical explanations
- [ ] add better between-set feedback and coach guidance
- [ ] decide whether `v0.2` adds player development or presentation depth
- [ ] improve save migration coverage as the state model grows

## Blockers

There are no hard technical blockers right now.

Current design questions that could affect scope:

- whether `v0.1` manages one athlete or a tiny squad
- how many raw stats the first engine pass should use directly
- how much between-set intervention should exist beyond the current single-talk layer

## Risks

### 1. Scope creep

The project will slow down badly if it adds:

- doubles
- long-term career systems
- live backend features
- detailed court animation

### 2. Engine ambiguity

If the rally model is not documented clearly before coding, tuning will become guesswork.

### 3. UI-first drift

If the browser shell is built before the engine contract is stable, the project may accumulate presentation code that later has to be rewritten.

## Maintainer Notes

Future sessions should read these files first:

- `docs/PRD.md`
- `docs/TECHNICAL_BRIEF.md`
- `docs/ROADMAP.md`
- `docs/reference/match-engine.md`
- `PRDs/v0.1/v0.1.md`

## Update Rule

Whenever the project changes materially, update this document in the same pass.

At minimum, revise:

- `Completed`
- `In Progress`
- `Next`
- `Blockers`
- `Status date`
