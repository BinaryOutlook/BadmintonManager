# Badminton Manager PRD

Status: Foundation draft
Owner: binaryoutlook
Last updated: 2026-04-22
Project phase: Headless simulation foundation

## 1. Purpose

This PRD defines the stable product direction for **Badminton Manager**.

It exists to answer five questions:

- what the game is
- what the player is trying to do
- what the first serious version includes
- which technical direction we are choosing on purpose
- which scope traps we are refusing to fall into

This document is intentionally written before implementation.

It does not replace:

- `docs/TECHNICAL_BRIEF.md` for architecture and implementation direction
- `docs/STATUS.md` for the current project snapshot
- `docs/reference/` for subsystem definitions
- `PRDs/vX.Y/` for iteration-specific delivery packets

## 2. Product Summary

**Badminton Manager** is a browser-based management simulation game where the player acts as a badminton coach and program manager rather than a racket-level avatar.

The player is not trying to control every swing directly.

The player is trying to:

- build a competitive singles program
- prepare players for tournaments through tactics and development
- make strong pre-match and between-set decisions
- understand why matches are won or lost
- turn a sequence of tactical and management choices into long-term competitive success

The intended feel is part scouting report, part coaching box, and part sports simulation dashboard.

## 3. Product Rule

The player is the coach, not the athlete.

That rule should stay visible in every major design decision.

The game becomes weaker if it drifts into:

- action controls
- reflex-based racket gameplay
- direct shuttle steering
- a disguised arcade sports game

The correct fantasy is strategic influence over preparation, tactics, and adaptation.

## 4. Product Thesis

Most sports games reward direct execution.

This game should reward interpretation, preparation, and match reading.

The key insight is this:

**Badminton can feel dramatic without simulating full physics if the game models risk, pressure, judgment, and fatigue clearly enough.**

That means the core experience should come from:

- choosing the right tactical stance
- reading player strengths and weaknesses
- surviving pressure moments
- watching the simulation explain the consequences of those decisions

## 5. Product Goals

For the first serious version, the product should:

- deliver a playable browser-based badminton management sim with a clear identity
- simulate singles matches through a deterministic, testable engine
- make player attributes, tactics, and pressure visibly matter
- support a full 16-player knockout tournament loop
- present matches through a commentary-first interface before attempting complex visuals
- remain local-first and easy to run during early development
- stay readable enough for future maintainers and future AI sessions to re-enter quickly

## 6. Non-Goals

The current phase is not trying to become:

- a full doubles simulation
- a real-time physics badminton game
- a massive career mode with transfers, sponsorships, or youth academies on day one
- a multiplayer game
- a backend-dependent live-service product
- a 3D broadcast simulator
- a mobile-native app

If a feature does not strengthen the coaching fantasy, the match engine, or maintainability, it should not be default scope.

## 7. Primary Users

### 7.1 Primary builder

The immediate primary user is the solo developer returning to the project after time away.

The repo, docs, and architecture must support fast re-entry and low confusion.

### 7.2 Players

The player is someone who wants:

- a sports management game rather than an action game
- short, readable, replayable tournament runs
- visible tactical trade-offs
- match commentary that explains cause and effect

### 7.3 Future contributors

Future collaborators should be able to understand:

- where the simulation rules live
- where player and tournament data live
- where UI state lives
- which docs define stable product truth versus current iteration work

## 8. Experience Pillars

### 8.1 Coach, not controller

The player should influence the match through:

- tactics
- target selection
- risk appetite
- energy management
- between-set talks

The player should not be asked to manually time swings or place shots in real time.

### 8.2 Cause and effect must stay legible

The player should be able to understand why points and matches turned.

Good explanations include:

- stamina faded in the third set
- a high-risk target kept missing wide
- poor anticipation created weak replies
- composure failed at `19-19`

Complexity is welcome. Obscurity is not.

### 8.3 The match engine should feel earned, not random

Randomness is necessary, but it should feel bounded by player quality, pressure, and tactical context.

The simulation should create outcomes such as:

- the stronger player usually wins
- the weaker player can still steal sets through form, tactics, and variance
- pressure moments feel different from early-rally exchanges

### 8.4 Presentation should explain the sport

The first UI should teach the player how the simulation thinks.

The commentary feed, point summaries, and stat panels should make the rules of the engine increasingly obvious across multiple matches.

### 8.5 Maintainability is part of the product

The project should be structured so future changes do not require rediscovering the whole system.

That means:

- deterministic simulation
- clear module boundaries
- stable docs
- versioned iteration packets

## 9. MVP Scope

The MVP should be intentionally narrow.

### 9.1 Format

- singles only
- one gendered circuit at a time if content scope requires it
- best-of-three match structure

### 9.2 Tournament scope

- one 16-player knockout tournament
- seeded player pool
- one managed player for the initial version

### 9.3 Match interaction scope

Before match:

- choose tactic package
- inspect opponent strengths and weaknesses

During match:

- watch commentary and score progression

Between sets:

- choose one team-talk adjustment

### 9.4 Presentation scope

The first playable version may use:

- text commentary
- point summaries
- simple momentum and pressure indicators

The first playable version does not require:

- a 2D court replay
- full animation
- live shot trajectory rendering

## 10. Core Gameplay Loop

The core loop for the first serious version should be:

1. Review the bracket and your player.
2. Choose a pre-match tactic package.
3. Simulate and watch the match through commentary and score flow.
4. Make a between-set talk if the match reaches the interval.
5. Advance through the bracket.
6. Review outcome summaries and key stats.

## 11. Core Systems

The early product depends on five systems:

- player model
- match engine
- tactics system
- tournament system
- persistence and progress state

Each system should have a dedicated reference document in `docs/reference/`.

## 12. Documentation Layers

This project should keep a deliberate document hierarchy:

- `docs/PRD.md`: stable product truth
- `docs/TECHNICAL_BRIEF.md`: architecture and implementation direction
- `docs/STATUS.md`: current state of the project
- `docs/ROADMAP.md`: milestone path across versions
- `docs/reference/*.md`: subsystem references
- `PRDs/vX.Y/`: versioned iteration packets

## 13. Success Criteria

The foundation phase is successful when all of the following are true:

- the product fantasy is clearly documented
- the MVP scope is narrow enough to finish
- the tech direction is documented and intentional
- the match engine is defined as a deterministic subsystem separate from the UI
- future sessions can tell what is stable versus what is still in motion

## 14. Open Questions

- Whether the first version manages a single athlete or a small squad should be confirmed before the long-term manager loop is designed.
- Whether official rankings, fictional rankings, or purely local tournament seeding is best for the first content pass remains open.
- Whether player growth belongs in `v0.2` or `v0.3` depends on how quickly the core match engine becomes trustworthy.
