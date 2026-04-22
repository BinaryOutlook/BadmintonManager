# Badminton Manager

A browser-based badminton management simulation about **managing the game instead of directly playing it**.

Most sports games ask you to control execution.

This project asks a different question:

> What if the interesting part is not hitting the shuttle, but shaping the conditions that decide who is more likely to win the next rally?

In **Badminton Manager**, you are the coach and manager, not the athlete on court. You do not time the smash yourself. You prepare the player, choose the tactical direction, watch the pressure build, and try to understand why the match turns when it does.

## Why This Project Exists

The core idea is simple, but the design space is huge.

We are exploring the fantasy of controlling a sport **indirectly**:

- before the match through tactics and preparation
- during the match through interpretation rather than reflexes
- between sets through coaching adjustments
- over time through deeper systems, more stats, and more customization

That inversion is the interesting part.

This is not meant to become a disguised arcade badminton game. The long-term vision is a management sim where the drama comes from:

- risk and reward
- pressure moments
- fatigue
- judgment
- player identity
- tactical adaptation

## Current State

The current version is intentionally small, but it is real and playable.

Right now, the game supports:

- a local-first browser app
- a 16-player seeded singles knockout tournament
- one managed player per run
- pre-match tactic selection
- set-by-set match simulation
- between-set team talks
- commentary-first presentation
- local save persistence

Just as importantly, it also has clear limitations.

Right now, we **cannot** control tactics at every point, define deep tactical trees, or manage a long-term career. That is not the final ambition. It is the minimum iteration that lets us prove the core simulation works before we add more complexity.

## The Big Vision

The current build is a starting point, not the destination.

Over time, we want to expand the player's control and the game's expressive depth:

- richer tactical control before and during matches
- better opponent scouting and exploit planning
- deeper player identities, strengths, weaknesses, and tendencies
- more detailed match and post-match statistics
- training and development systems
- broader tournament and season structures
- more customization in how a coach wants their athlete to play

The goal is to define those details carefully over time instead of pretending we already know the final perfect system.

## Interesting Concepts We Want To Explore

This project is as much about design questions as it is about code.

Some of the most interesting questions for us are:

- What does it mean to manage a sport instead of playing it directly?
- How much control should a player have before the game stops feeling like management?
- How can commentary explain cause and effect instead of just decorating outcomes?
- How much randomness feels exciting, and how much feels fake?
- How do we make a stronger player usually win while still allowing believable upsets?
- How do tactics modify player identity without replacing it?
- How do we make simulation depth readable instead of opaque?

If those questions sound interesting to you, you are looking at the right project.

## Technical Implementation

The project currently uses a local-first web stack:

- `React`
- `TypeScript`
- `Vite`
- `Zustand`
- `Zod`
- `Vitest`
- `Playwright`

The architecture is intentionally split so the simulation stays independent from the UI:

- `src/game/core/`: deterministic match engine and simulation logic
- `src/game/tournament/`: bracket progression and tournament flow
- `src/game/store/`: local app state and persistence orchestration
- `src/game/content/`: seeded players and tactics
- `src/game/commentary/`: machine output turned into readable match copy
- `src/components/`: browser UI surfaces

The important rule is this:

**the UI should present the match, not decide it**

The match engine is deterministic for a given seed and input set. That makes it easier to:

- test
- tune
- debug
- explain outcomes

## Running The Project

### Requirements

- `Node.js`
- `npm`

### Quick start

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

### Useful commands

```bash
npm run dev         # start the app locally
npm test            # run unit tests
npm run build       # typecheck and build the production bundle
npm run test:e2e    # run Playwright browser smoke tests
```

## Documentation Map

If you want the deeper reasoning behind the project, start here:

- `docs/PRD.md` — stable product direction
- `docs/TECHNICAL_BRIEF.md` — architecture and implementation strategy
- `docs/STATUS.md` — current project snapshot
- `docs/reference/` — subsystem references
- `PRDs/v0.1/v0.1.md` — the current iteration packet

## Collaboration

We want this repo to be friendly to future maintainers, future AI sessions, and real collaborators.

If you want to get involved, there are several great directions:

- simulation tuning and balance
- badminton-specific tactical modeling
- commentary writing and narrative clarity
- UI and information design
- testing and verification
- documentation and architecture cleanup

Contributions are especially valuable when they help us:

1. explore the technical implementation more clearly
2. investigate interesting management-sim concepts more deeply
3. keep the project welcoming for other people who want to build with us

## Contribution Mindset

This project works best when contributors respect a few core rules:

- keep the simulation core separate from presentation code
- prefer readable systems over clever but opaque abstractions
- test behavior instead of guessing
- document important decisions
- preserve the coaching fantasy rather than drifting into direct action gameplay

## Current Tone And Ambition

This is still an early version.

That should be exciting, not discouraging.

The current build proves we already have something real:

- a working tournament loop
- a deterministic match engine
- a first pass at tactical influence
- a documentation system that can support long-term growth

From here, the fun part is not just "adding more stuff."

The fun part is deciding **which kinds of control actually make the game more interesting**.
