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


## Autonomous Universe Simulation

Career time advances the circuit, not only the managed-athlete diary. The domain service
`simulateUniverseThroughDate` in `game/career/universe.ts` is the universe clock contract:

```ts
function simulateUniverseThroughDate(args: {
  career: CareerState;
  activeTournament: TournamentState | null;
  targetDate: string;
}): {
  career: CareerState;
  activeTournament: TournamentState | null;
  eventsSimulated: string[];
};
```

For new saves, the invariant is:

$$
\forall e \in \texttt{career.events},\quad
\texttt{career.date} > \texttt{eventEndDate}(e)\Rightarrow\texttt{CareerUniverseTournamentRecord}(e)
$$

The simulator is deterministic and idempotent. Running it twice for the same save/date must not
duplicate universe event rows, match records, ranking settlements, or player achievements.

The service may publish a deterministic field at `event.drawDate`, and it completes overdue
non-entered events with a full 16-player bracket, scorelines, champion, runner-up, placements,
ranking points, and champion/runner-up achievements. It also archives completed active
tournaments after managed title runs or post-elimination closeouts.

Managed-match immutability is stricter than the overdue invariant. If an active entered event is
still waiting for user-played managed match resolution, universe simulation records the draw as
`in_progress` but does **not** auto-complete that managed match.

The product boundary is:

$$
\text{Universe} > \text{Managed Athlete Diary}
$$

React components consume these records; they do not run tournament simulation.

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

## Timeline And Calendar Route Split

The left command rail treats `Timeline` and `Calendar` as separate first-class pages, not tabs inside a shared
`Schedule` container.

```text
Timeline -> chronological event context
Calendar -> one-month manager diary
```

- `Timeline` preserves broader chronological event-log context, upcoming event operations, and archived event records.
- `Calendar` is a standalone month grid of confirmed manager commitments only.
- `Upcoming` and `Past Events` remain list-style operational surfaces on the Timeline page until a separate event-desk
  route exists.
- `Calendar` must not render as a Timeline or Schedule tab. It renders exactly one visible month at a time with
  local Previous / Today / Next controls.

The confirmed calendar rule is:

$$
\text{Calendar entry} \iff \text{played match} \lor \text{confirmed scheduled commitment} \lor \text{manager-relevant deadline}
$$

The default visible month is the month containing `career.date`. Month navigation only changes UI-local month cursor
state; it must not mutate `career.date` or advance simulation state.

For knockout rounds:

$$
\text{Future round visible} \iff \text{managed player has qualified for that round}
$$

That means a completed managed match may appear with `W` or `L`, a current draw/first-round commitment may appear,
and a qualified future round may appear. Speculative `QF`, `SF`, or `F` placeholders do not belong in the month-grid
Calendar before qualification; those remain tournament-home or Timeline context.

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

## Universe Event Records And Career Event History

`CareerState.universeEvents` is the tournament-world archive. It is not a managed-player diary.
Each `CareerUniverseTournamentRecord` stores:

- season id and event id
- source: `live_progression`, `post_elimination`, `unentered_sim`, `backfill_sim`, `archive_import`, or `legacy_unavailable`
- status: `scheduled`, `drawn`, `in_progress`, `completed`, or `legacy_unavailable`
- draw/start/completion dates
- deterministic entrants
- completed match ids
- champion and runner-up
- placement rows with points awarded
- managed-player result, including `not_entered` when the athlete skipped or missed the field

Legacy saves with enough match truth may hydrate completed `archive_import` universe records. If an
old save only has summary history and cannot prove entrants, bracket, champion, and runner-up, the
record is labeled `legacy_unavailable`; the UI must not invent champions for that gap.

`CareerState.eventHistory` remains a managed-program summary archive for prior UI surfaces. Played
closeouts are recorded when the managed run ends by title, final loss, or earlier elimination. New
skipped/non-entered event truth is carried by `universeEvents`; Past Events may synthesize list rows
from completed universe records for navigation, but the authoritative tournament record is
`career.universeEvents`.

History statuses are:

```text
champion | runner_up | semi_final | quarter_final | round_of_16
skipped | missed_deadline | withdrawn
```

`CareerState.matchHistory` stores authoritative completed universe match records for played managed
matches, quick-simulated active-bracket matches, autonomous universe simulations, deterministic
backfills, and legacy imports:

```ts
type CareerMatchRecordSource =
  | "played"
  | "quick_sim"
  | "universe_sim"
  | "backfill_sim"
  | "archive_import";
```

The source field distinguishes manually played results from simulation/import paths. Legacy/imported
match records without source metadata hydrate as `archive_import`. New universe match ids use stable
season/event/round/slot material rather than randomness.

## Player Profile Records

Player Profile Career records use persisted universe facts only:

$$
\text{Profile record} =
\texttt{career.matchHistory}
+ \texttt{career.playerAchievements}
$$

All-time W-L, win percentage, and head-to-head leaders are derived from completed
`career.matchHistory` rows for the player, including non-managed quick-simulated matches. Titles,
runner-up finishes, and finals are derived from `career.playerAchievements` champion/runner-up rows.

Bracket snapshots in `eventHistory.bracketSnapshot` are presentation archives for tournament homes and
timeline context. They must not be re-read as player-profile match records; doing so would fabricate
history for old saves and can double-count matches already persisted in `career.matchHistory`.

## Persistence

Older current saves that predate event operations fields and `seasonPoints` remain valid.

Migration safety works in two layers:

- Zod defaults let old ranking/event rows parse.
- `migratePersistedSave` hydrates saved event rows from the fictional catalog so deadlines, locations, draw dates, and eligibility metadata are present after load/import.
- version `8` career saves migrate through the current version with `eventHistory: []`.
- version `9` career saves migrate to version `10` with `universeEvents: []` or honest legacy universe records when old `eventHistory` exists.
- current version `10` saves run `simulateUniverseThroughDate` safely on load/import for the save date.
- legacy quick-tournament saves that contain the previous real event name are normalized to the fictional `Harborline Open` name during load/import.
- legacy match history rows without a source hydrate with the honest `archive_import` fallback.

The active local storage key remains `badminton-manager-save`.
