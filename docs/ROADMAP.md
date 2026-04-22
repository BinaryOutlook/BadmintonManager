# Roadmap

## Overview

This roadmap keeps the project sequence disciplined.

The game should be built from the inside out:

1. headless engine
2. tournament state
3. browser presentation
4. manager loop expansion

## `v0.1` Foundation and Tournament MVP

Status: In Progress

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

Status: Planned

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
