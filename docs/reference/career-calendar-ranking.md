# Career Calendar And Ranking Reference

This document defines the fictional career event and ranking model used by **Badminton Manager**.

The model is inspired by real badminton calendar concepts, but it is deliberately fictional:

- event names, locations, venues, and sponsors are invented
- points tables are gameplay tuning values, not copied official tables
- rankings are a simplified circuit list, not a full official world-ranking replica
- the playable draw remains the existing `16`-player knockout until the tournament engine changes

## Event Model

Each `CareerEventDefinition` now carries operational calendar data:

```text
event week
  |
  +-- ranking cutoff
  +-- seeding snapshot
  +-- entry deadline
  +-- withdrawal deadline
  +-- draw publication
  `-- start date / duration
```

The fields live in `game/career/models.ts` and catalog values live in `game/career/events.ts`.

Core fields:

- `weekNumber`
- `location.city`, `location.country`, `location.venue`
- `entryDeadline`
- `rankingCutoffDate`
- `seedingDate`
- `withdrawalDeadline`
- `drawDate`
- `drawSize`
- `seedCount`
- `eligibility`
- `stakesLabel`
- prize, cost, prestige, and ranking-point values

Deadline ordering is deterministic:

$$
\text{ranking cutoff} \le \text{seeding} \le \text{entry deadline}
\le \text{withdrawal deadline} \le \text{draw date} \le \text{start date}
$$

## Entry Eligibility

`eventEligibilityFor(state, event)` is the entry gate used by store actions and tests.

It checks:

- whether the entry deadline has passed
- current circuit rank
- total circuit points
- season race points for the finale
- readiness
- completed event volume for the finale fallback

If an event has not been entered and the career date moves past `entryDeadline`, the dynamic status becomes `missed_deadline`. That state is computed from save data, so older saves do not need a separate missed-deadline array.

## Event Status

`eventStatusFor(state, event)` derives the display/action status from existing career state:

```text
completed
entered -> draw_published -> in_progress
missed_deadline
entry_open / scheduled
```

This is intentionally derived rather than hand-mutated. The same save and date always produce the same event status.

## Seeding Snapshot

`buildEventSeedingSnapshot` produces a deterministic seed preview or locked seed list from the current fictional circuit ranking.

Important honesty boundary:

- this snapshot supports calendar and event-desk presentation
- it does not yet replace the tournament engine's existing draw construction
- UI should call it a ranking-based snapshot or preview, not proof of full official draw fidelity

## Ranking Points

The game tracks two related values:

- `points`: total simplified circuit ranking points
- `seasonPoints`: points earned in the current career season race

When a managed player or rival earns event points, both values update deterministically and a history row records:

- event id
- round or placement
- points
- date
- season id
- fictional tier

The current rank order is:

$$
\text{rank order} = \operatorname{sort}(\text{points descending},\ \text{player id ascending})
$$

This is a deliberate simplification. The model does not implement official rolling-week windows, exact official point tables, or separate official tour lists.

## Persistence

Older current saves that predate event operations fields and `seasonPoints` remain valid.

Migration safety works in two layers:

- Zod defaults let old ranking/event rows parse.
- `migratePersistedSave` hydrates saved event rows from the fictional catalog so deadlines, locations, draw dates, and eligibility metadata are present after load/import.

The active local storage key remains `badminton-manager-save`.
