# Roadmap

## Overview

This roadmap keeps the project sequence disciplined.

The game should be built from the inside out:

1. headless engine
2. tournament state
3. browser presentation
4. manager loop expansion

## `v0.1` Foundation and Tournament MVP

Status: Completed

Goal:

- establish the technical stack
- implement the core singles simulation
- seed a 16-player tournament
- expose the match through a simple browser interface

Exit criteria:

- the app boots locally
- one full 16-player tournament can be completed
- match outcomes are reproducible from a seed
- commentary and score flow are readable

## `v0.2` Super Build: Command Center and Tactical Operations

Status: Completed / Stabilized by `v0.2.1`

Goal:

- ship the command-center visual identity shown in the `UIDEMOs` mockups
- add opponent scouting, athlete dossiers, and tactical intel surfaces
- upgrade live match presentation to point-by-point tactical operations
- add richer telemetry, recap storytelling, and stronger end-of-run payoff

Exit criteria:

- the player can complete a run through the new command-center shell
- live matches progress point by point while staying deterministic
- scouting, directives, and team talks visibly explain why matches turn
- the tournament recap feels like a meaningful conclusion instead of a reset screen

## `v0.2.1` Command-Center Patch and UI Rearrangement

Status: In Progress

Goal:

- fix the bugs found during command-center playtesting
- make between-set team talks visibly selectable and safely interval-only
- make top navigation and sidebar command options clickable
- render the knockout tree as a full binary bracket through the final
- rearrange the overview so the next-opponent read is a head-to-head comparison
- place tactic lock-in beside the matchup instead of below it
- tighten the screen layout before the next feature-bearing update

Exit criteria:

- the player can compare their athlete and opponent without scanning a wide metrics wall
- the bracket tree reads as a proper tournament tree
- the tactic choice, matchup read, and bracket context sit in a clearer pre-match order
- `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e` pass
- the next update can focus on small, innovative, identity-shaping features instead of cleanup

## `v0.2.2` Small Innovative Feature Probe

Status: Planned

Goal:

- add a small feature that changes how the existing tournament loop feels rather than expanding scope broadly
- make tactical intelligence, opponent reads, or post-match insight feel more original and coach-driven
- keep the feature compact enough to preserve the local-first tournament loop

Candidate directions:

- contextual tactical intel that explains one real engine state clearly
- a sharper directive with a memorable trade-off
- opponent pattern reads that emerge after a few points
- a post-match turning-point card that explains why one stretch decided the match

Exit criteria:

- the feature is small enough to test and explain
- the feature strengthens the coach fantasy
- the feature uses real simulation state rather than decorative copy
- the command-center layout from `v0.2.1` remains readable

## `v0.3` Manager Loop Expansion

Status: Planned

Goal:

- add training and player development
- add schedule progression beyond a single tournament
- introduce lightweight resource management around preparation

Exit criteria:

- the player can improve athletes over time
- the game has a meaningful next-day or next-event loop
- progression remains readable and not spreadsheet-heavy

## `v0.4` Architecture Hardening

Status: Planned

Goal:

- harden save migration
- improve seeded balance tooling
- separate content and simulation boundaries more sharply

Exit criteria:

- saves are versioned and resilient
- seeded simulation reports can surface balance problems
- future contributors can work without unclear contracts

## Not On The Near-Term Roadmap

These are intentionally not default scope right now:

- doubles simulation
- online multiplayer
- matchmaking service
- cloud saves
- 3D or broadcast-grade court rendering
- monetization features
