# Roadmap

## Overview

This roadmap keeps the project sequence disciplined.

The game should be built from the inside out:

1. headless engine
2. tournament state
3. browser presentation
4. manager loop expansion

## `v0.1` Foundation and Tournament MVP

Status: Planned

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

## `v0.2` Match Presentation and Tactical Clarity

Status: Planned

Goal:

- improve commentary quality
- add clearer pressure, fatigue, and momentum reads
- improve tactic explanation surfaces
- make between-set intervention feel meaningful

Exit criteria:

- the UI explains why matches turned
- tactic choices are visible in the match output
- players can distinguish pressure collapse from ordinary variance

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
