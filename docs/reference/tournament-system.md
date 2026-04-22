# Tournament System Reference

This document defines the first tournament layer for **Badminton Manager**.

## Design Goal

The first tournament system should be small enough to ship and rich enough to make matches feel connected.

It should answer:

- who is in the tournament
- who plays whom next
- what the player is trying to survive or win

## MVP Format

The MVP tournament is:

- a 16-player singles knockout
- one managed player entering the draw
- one champion at the end of the run

## Bracket Model

The bracket should be explicit and inspectable.

Suggested structure:

```ts
interface Tournament {
  id: string;
  name: string;
  round: "R16" | "QF" | "SF" | "F";
  entrants: TournamentEntrant[];
  matches: TournamentMatch[];
  championId?: string;
}
```

Each entrant should include:

- player identity
- seed
- elimination status

## Seeding Rule

The first version should use a fixed seed order.

That gives the project:

- predictable test fixtures
- easier bracket QA
- less noise while the engine is still being tuned

Random draw logic can come later if it adds real value.

## Match Flow

Each tournament round should follow this sequence:

1. show the bracket and next opponent
2. allow tactic selection
3. simulate the match
4. advance the winner
5. update round state
6. stop when the managed player loses or wins the final

## Persistence Rule

Tournament progress should be saveable as local application state.

At minimum, save:

- current round
- completed results
- next scheduled match
- selected player
- selected tactic package for the next match if needed

## Presentation Rule

The bracket view should prioritize clarity over visual flair.

The player should be able to read:

- current round
- upcoming opponent
- path to the title
- completed results

The first version does not require:

- animated bracket transitions
- ranking points systems
- calendar scheduling beyond the single event

## Non-Goals For `v0.1`

The first tournament system should not include:

- league tables
- multi-event seasons
- transfers
- academy rosters
- sponsorship systems
- travel and facility management
