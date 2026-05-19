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

Public tier labels are fictional circuit names: `Circuit 300`, `Circuit 500`, `Circuit 750`, and `Circuit 1000`, plus domestic/invitational/finale labels. Legacy save payloads using the previous public tier text are normalized at load/import time so old local saves keep working without reintroducing those labels into current UI copy.

Deadline ordering is deterministic:

$$
\text{ranking cutoff} \le \text{seeding} \le \text{entry deadline}
\le \text{withdrawal deadline} \le \text{draw date} \le \text{start date}
$$

Every playable `16`-player career event must have at least four event days. The managed main-draw cadence is schedule-aware:

| Managed round | Career date |
| --- | --- |
| `R16` | `event.startDate + 0` |
| `QF` | `event.startDate + 1` |
| `SF` | `event.startDate + 2` |
| `F` | `event.startDate + 3` |

The source of truth is `game/career/matchSchedule.ts`. Store-level day advancement must consult that helper so a due or overdue managed match cannot be skipped by a direct `advanceCareerDay()` call.

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
between_rounds -> next scheduled round date
missed_deadline
entry_open / scheduled
```

This is intentionally derived rather than hand-mutated. The same save and date always produce the same event status.

Career stage semantics:

- `event_entered`: the event is entered, but no managed match is playable today.
- `pre_match`: the next scheduled managed match is due or overdue.
- `post_match`: a just-finished match needs review.
- `between_rounds`: a non-final managed win has been reviewed; the next round is scheduled for a future career date.
- `event_complete`: the active event has closed.

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

Completed entered tournaments now settle ranking truth from the completed bracket, not just the
managed-player diary. When an event reaches a champion, champion, runner-up, semi-final, quarter-final,
and round-of-16 placement points are written for every ranked player in that bracket. Existing ranking
history rows for the same `playerId + eventId` are treated as settled facts so reloads or replayed
closeouts do not double-count points.

## Career Event History

`CareerState.eventHistory` stores one persistent record per event. Played closeouts are recorded when the managed run ends by title, final loss, or earlier elimination. Skipped or missed events are recorded after their event end date passes.

History statuses are:

```text
champion | runner_up | semi_final | quarter_final | round_of_16
skipped | missed_deadline | withdrawn
```

Records include event dates, tier, result status, awarded points, prize money, entry/travel costs, net cash, match ids, scorelines, and lightweight achievements such as `First Title`.

For new completed tournament saves, the event history record also stores a closed bracket snapshot and
the full set of completed match ids/scorelines when available. Older history rows can still be
summary-only; UI should label those as fallback archives rather than inventing missing bracket truth.

`CareerState.matchHistory` stores universe match records for both played managed matches and quick-simulated
non-managed matches:

```ts
type CareerMatchRecordSource = "played" | "quick_sim" | "archive_import";
```

The source field distinguishes manually played results from quick simulation. Legacy/imported match
records without source metadata hydrate as `archive_import`.

## Persistence

Older current saves that predate event operations fields and `seasonPoints` remain valid.

Migration safety works in two layers:

- Zod defaults let old ranking/event rows parse.
- `migratePersistedSave` hydrates saved event rows from the fictional catalog so deadlines, locations, draw dates, and eligibility metadata are present after load/import.
- version `8` career saves migrate to version `9` with `eventHistory: []`.
- legacy quick-tournament saves that contain the previous real event name are normalized to the fictional `Harborline Open` name during load/import.
- legacy match history rows without a source hydrate with the honest `archive_import` fallback.

The active local storage key remains `badminton-manager-save`.
