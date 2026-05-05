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

Status: Completed / Superseded by `v0.2.2`

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

## `v0.2.2` Roster Draw Expansion

Status: Completed / Superseded by `v0.2.3`

Goal:

- expand the local roster beyond the tournament field size
- add six Trophy Titans with distinct title-style names, stat profiles, and playstyle hooks
- add 15 Honorable Mentions with title-style names and 85-88 OVR profiles
- keep ordinary fictional depth players on plausible real-name constructions and capped at 86 OVR
- keep each tournament as a 16-player knockout
- draw exactly 16 event entrants from the larger pool while always including the managed athlete
- sort setup roster selection by OVR so the strongest available athletes are easy to scan
- use nationality-code identifiers beside athlete names in setup selection
- preserve deterministic tournament fields for identical run seeds

Exit criteria:

- the content pool contains 47 fictional athletes
- tournament creation draws exactly 16 unique entrants from the larger pool
- the managed athlete is always included in the event field
- the same seed creates the same event field
- different seeds can create different event fields
- headline legend-inspired OVR targets are covered by tests
- Honorable Mention OVR ratings stay inside the 85-88 band
- ordinary fictional depth players stay capped at 86 OVR
- title-style naming remains reserved for Trophy Titans and Honorable Mentions
- setup roster cards display OVR rank instead of content seed position
- setup roster names sit next to nationality-code identifiers instead of drifting toward rank text
- the command-center layout from `v0.2.1` remains readable

## `v0.2.3` Game-algorithm

Status: Active

Goal:

- introduce an explicit detailed/quick simulation fidelity boundary
- keep managed matches on the high-fidelity point and rally simulator
- move non-managed tournament matches to a calibrated quick simulator
- preserve compatible tournament results across both simulator paths
- deepen the active-match algorithm toward richer real-life badminton dynamics
- keep commentary and telemetry tied to real engine events

Exit criteria:

- managed matches use detailed simulation
- background matches use quick simulation
- both simulator modes are deterministic
- quick mode obeys best-of-three scoring, `21` by `2`, and the `30` point cap
- quick mode returns tournament-compatible match results and plausible aggregate stats
- detailed mode continues to support directives, team talks, point feed, and recap stats
- seeded batch checks compare quick and detailed win-rate bands
- `docs/reference/match-simulation-fidelity.md` stays aligned with implementation
- `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e` pass

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
