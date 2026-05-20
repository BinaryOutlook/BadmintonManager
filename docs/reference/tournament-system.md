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
- a fictional quick-tournament event named `Harborline Open` at `Circuit 750`

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
- randomly draw the remaining entrants from `game/content/players.ts`
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
5. quick-sim any missing non-managed matches without rerolling completed facts
6. update round state
7. if the managed player is eliminated, quick-sim the remaining non-managed rounds to a champion
8. stop when the full event has a champion

## Persistence Rule

Tournament progress should be saveable as local application state.

At minimum, save:

- current round
- completed results
- next scheduled match
- selected player
- selected tactic package for the next match if needed
- completed career-event bracket snapshots when a career event closes
- universe event records in `career.universeEvents`, including entrants, match ids, champion, runner-up, placements, source, and managed-player result
- universe match records with source metadata: `played`, `quick_sim`, `universe_sim`, `backfill_sim`, or safe legacy/import fallback

Legacy save compatibility:

- the active local key remains `badminton-manager-save`
- older saves that contain the previous quick-tournament real event name are accepted and normalized
  to `Harborline Open` during load/import
- older public tier labels are accepted and normalized to fictional `Circuit` labels
- older match-history rows without source metadata are accepted as `archive_import`
- old career histories without enough bracket truth hydrate as `legacy_unavailable` universe records instead of fabricated champions

## Autonomous Career Tournament Rule

Career tournaments are universe-first. A non-entered event can still publish a deterministic field and
complete to a champion as calendar time passes. Entered active events preserve user-played managed
match facts: a played managed result is immutable, and an overdue active managed match is not
auto-played by background simulation.

The domain clock lives in `game/career/universe.ts`; React tournament homes only render resolved
state, match history, and universe records.

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

## Career Event Field Snapshots And Final Seeding

Career tournament fields now use `EventFieldSnapshot` when the universe publishes or completes an event.

The snapshot records:

- invited player ids
- non-entry rows and reasons
- alternate entries and replaced player ids
- final player ids
- final seed rows with rolling rank and points

Seeding belongs after non-entry and alternate substitution:

$$
\text{seed order}=\operatorname{sort}(\text{final field},\ \text{rolling rank ascending})
$$

An alternate never inherits the seed of the withdrawn invitee. The bracket still uses the existing 16-player placement order for playable events:

```text
1 v 16, 8 v 9, 5 v 12, 4 v 13, 6 v 11, 3 v 14, 7 v 10, 2 v 15
```

The 32-player field-selection contract is tested for non-entry and duplicate safety, but full 32-player bracket rendering remains deferred until the tournament engine gains true `R32` support.
