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

The tournament keeps a 16-player knockout bracket, but the content pool may be larger than
16 athletes.

At run creation:

- include the managed athlete
- randomly draw the remaining entrants from `src/game/content/players.ts`
- stop at exactly 16 tournament entrants
- reseed the drawn field by content seed order before applying the bracket order

This keeps the bracket shape stable while allowing the player list to feel fresh between runs:

```text
player pool -> draw 16 entrants -> reseed field -> R16 bracket
```

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

For the 16-player knockout, the command-center bracket should render the full binary path even
before later rounds have concrete competitors:

```text
R16: 8 matches -> QF: 4 matches -> SF: 2 matches -> F: 1 match
```

Future matches can appear as placeholders such as `Winner R16-1` until the tournament model
creates the real round.

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
