# TIX-021: Autonomous Universe Simulation Contract

Status: Draft remediation ticket
Priority: Critical
Target project: `BadmintonManager`
Target systems: career simulation, tournament simulation, rankings, tournament homes, player profiles, persistence
Prepared on: 2026-05-20
Primary files: `game/career/calendar.ts`, `game/career/events.ts`, `game/career/models.ts`, `game/career/matchSchedule.ts`, `game/career/hubs.ts`, `game/store/store.ts`, `game/store/save.ts`, `game/tournament/tournament.ts`, `game/selectors/player.ts`, `components/CareerWorkbench.tsx`, `app/pages/PlayerProfilePage.tsx`, `tests/unit/career.test.ts`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/player-profile.test.ts`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 2
Remediates: `docs/arc_tix/TIX-017-parallel-universe-tournament-simulation.md`, `docs/arc_tix/TIX-019-universe-wide-player-records.md`

## 1. Commander Intent

Make the career world self-sustaining.

Every tournament in the career calendar must resolve as part of the save universe, whether or not the managed athlete enters, advances, loses early, skips the event, or ever appears in the draw.

The product rule is:

$$
\text{Universe} > \text{Managed Athlete Diary}
$$

The managed athlete is one participant inside the world:

$$
\text{Managed Athlete} \in \text{Universe}
$$

not:

$$
\text{Universe} = \text{Managed Athlete Matches}
$$

This is the Football Manager-style principle that matters most: the world keeps moving when the user is not looking at it.

## 2. Why This Remediation Exists

The current implementation improved tournament homes, records, and non-managed completion after managed-player elimination. That was useful, but it still does not fully satisfy the product expectation.

The missing contract is broader:

- competitions must have data even when the managed athlete never enters,
- tournaments must simulate as calendar time passes,
- rankings must reflect the wider circuit,
- player profiles must be fed by the whole world,
- event homes must not be empty just because the user was not involved.

The user-facing failure is simple: too many competitions look like they do not exist unless the managed athlete touches them.

That breaks the management illusion.

## 3. Universe Invariant

For every career event whose end date has passed, the save must have an event outcome record.

The invariant is:

$$
\forall e \in \text{career.events},\quad
\texttt{career.date} > \texttt{e.endDate}
\Rightarrow
\texttt{UniverseEventRecord}(e)
$$

The record must include, at minimum:

- entrants,
- completed bracket or completed match records,
- champion,
- runner-up,
- placement by round,
- match scorelines,
- ranking deltas,
- player achievement writes for champion and runner-up.

If a legacy save cannot truthfully provide that data, the system may mark the record as `legacy_unavailable`. New simulation code must not produce fresh `legacy_unavailable` records.

## 4. Simulation Clock Contract

Career day advancement must progress the universe, not only the managed athlete.

Required service:

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

This service must be:

- deterministic,
- idempotent,
- safe to run on load/import,
- safe to run after every career day advance,
- safe to run after managed match review,
- incapable of duplicating match records, achievements, or ranking points.

Idempotency rule:

$$
S(S(\text{career}, d), d) = S(\text{career}, d)
$$

where \(S\) is `simulateUniverseThroughDate`.

## 5. Tournament Progression Contract

Each event should progress according to its fictional schedule.

Minimum acceptable progression:

| Date condition | Required universe behavior |
| --- | --- |
| `career.date >= event.drawDate` | Ensure deterministic entrants/draw exist. |
| `career.date >= event.startDate + 0` | Resolve due `R16` matches that are not waiting for managed play. |
| `career.date >= event.startDate + 1` | Resolve due `QF` matches that are not waiting for managed play. |
| `career.date >= event.startDate + 2` | Resolve due `SF` matches that are not waiting for managed play. |
| `career.date >= event.startDate + 3` | Resolve due `F` and close the event. |
| `career.date > event.endDate` | Event must have a complete universe outcome. |

If the implementation cannot yet model partial daily round progression cleanly, it may complete overdue non-managed events at event closeout as a first remediation. However, entered managed events must still preserve the existing match-day flow and must never auto-simulate a due managed match before the user plays it.

## 6. Managed Match Integrity Contract

Manually played managed matches are fixed facts.

The universe simulator may fill missing non-managed matches, but it must not rewrite a user-played result.

The rule is:

$$
\text{played managed result} = \text{immutable universe fact}
$$

Required behavior:

- If the managed athlete wins and advances, the next managed round remains user-playable on its scheduled date.
- If the managed athlete loses in any round, the rest of the event continues without them.
- If the managed athlete never enters, the entire event still simulates.
- If the managed athlete enters but withdraws or misses, the event still simulates with a valid field.

## 7. Data Model Contract

Do not overload managed-player event history as the only world archive.

Introduce or formalize a universe event record that represents the tournament itself.

Suggested shape:

```ts
type UniverseEventRecordSource =
  | "live_progression"
  | "post_elimination"
  | "unentered_sim"
  | "backfill_sim"
  | "archive_import"
  | "legacy_unavailable";

type CareerUniverseTournamentRecord = {
  seasonId: string;
  eventId: string;
  source: UniverseEventRecordSource;
  status: "scheduled" | "drawn" | "in_progress" | "completed" | "legacy_unavailable";
  drawDate: string;
  startDate: string;
  completedAt: string | null;
  entrants: string[];
  matchIds: string[];
  championId: string | null;
  runnerUpId: string | null;
  placements: Array<{
    playerId: string;
    resultRound: "R16" | "QF" | "SF" | "F" | "champion";
    pointsAwarded: number;
  }>;
  managedPlayerResult: "not_entered" | "R16" | "QF" | "SF" | "F" | "champion" | null;
};
```

Recommended state field:

```ts
type CareerState = {
  // existing fields...
  universeEvents: CareerUniverseTournamentRecord[];
};
```

If a different name is chosen, keep the semantics explicit. The field must represent tournament-world truth, not merely the managed player's participation history.

## 8. Match Record Contract

All completed universe matches must write to the authoritative match-history stream.

Existing source values may be reused if preferred:

```ts
type CareerMatchRecordSource = "played" | "quick_sim" | "archive_import";
```

If more precision is useful, add:

```ts
type CareerMatchRecordSource =
  | "played"
  | "quick_sim"
  | "universe_sim"
  | "backfill_sim"
  | "archive_import";
```

Every match record must include:

- stable id,
- `seasonId`,
- `eventId`,
- round,
- date,
- player A,
- player B,
- winner,
- scoreline,
- source.

Stable id recommendation:

```ts
const recordId = `${seasonId}:${eventId}:${round}:${matchSlot}`;
```

Never generate random ids for universe match records.

## 9. Entrants And Draw Contract

Each tournament must have a deterministic field.

Use the existing roster and ranking structures to select entrants. The exact selection algorithm can remain simplified, but it must be stable.

Required entrant principles:

- entered managed athlete is included when eligible and entered,
- non-entered events still get a valid 16-player field,
- field selection uses deterministic seed material,
- no duplicate entrants,
- missing or retired players fail safely,
- tournament home can display the field before completion once the draw exists.

Seed material should include:

```ts
seasonId
eventId
event.drawDate
career.saveSeed or deterministic career identity
```

The same save state must produce the same draw.

## 10. Ranking And Achievement Contract

Completed universe events must affect the world.

For every completed event:

- champion receives champion points,
- runner-up receives finalist points,
- semi-finalists receive semi-final points,
- quarter-finalists receive quarter-final points,
- round-of-16 exits receive entry/round points if the current ranking model supports them,
- `career.playerAchievements` records champion and runner-up,
- `career.matchHistory` records all completed matches.

The ranking settlement must be idempotent:

$$
\text{same player} + \text{same event} \Rightarrow \text{one ranking settlement}
$$

Do not double-count points when:

- the user reloads,
- a day is advanced twice in tests,
- a tournament home is opened,
- an import preview hydrates old data,
- a managed match review triggers event closeout.

## 11. Tournament Home Contract

Tournament homes must be universe-first.

For any event:

| Event state | Tournament home must show |
| --- | --- |
| Future, draw not published | schedule, entry state, ranking cutoff, prize/points, no fake draw |
| Draw published | deterministic field/draw preview |
| In progress | completed rounds so far and remaining scheduled rounds |
| Completed | champion, runner-up, bracket/match evidence, ranking settlement |
| Legacy unavailable | honest fallback label, no invented champion |

Completed non-entered events must still display a champion and runner-up.

The home page must not imply:

$$
\text{No managed participation} \Rightarrow \text{No event data}
$$

## 12. Player Profile Contract

Player profiles must consume the universe stream.

For every player:

$$
\text{profile record}
=
\text{all persisted universe matches for that player}
+ \text{all persisted universe achievements for that player}
$$

The managed athlete may receive spotlight treatment, but selectors must not filter the world down to managed-athlete interactions.

Required proof:

- a non-managed player can show wins from a tournament the managed athlete skipped,
- a head-to-head can exist where neither player is the managed athlete,
- a non-managed champion can show a title from a simulated event.

## 13. Persistence And Migration Contract

This change likely requires a save-version bump.

Migration requirements:

- old saves parse safely,
- missing `universeEvents` defaults to `[]`,
- new saves always write universe event records as time passes,
- old completed managed events with sufficient bracket/match data may hydrate a universe record,
- old events without sufficient truth may be marked `legacy_unavailable`,
- optional deterministic backfill may create `backfill_sim` records for past unobserved events, but it must be labeled internally and must not duplicate existing records.

The implementation should prefer useful world data for active saves while staying honest about imported legacy gaps.

## 14. Implementation Sequence

Recommended sequence:

1. Add the universe event state model and save migration.
2. Build deterministic entrant/draw creation for non-entered events.
3. Build `simulateUniverseThroughDate` as an idempotent domain service.
4. Wire the service into career day advancement and managed event closeout.
5. Write match records, ranking settlements, and achievements from universe completion.
6. Update tournament homes to read universe event records for all events.
7. Update player-profile selectors only if existing universe-wide selectors miss the new records.
8. Add focused unit tests before broad Playwright coverage.

Keep simulation logic in `game/core/`, `game/tournament/`, or `game/career/`. React components must only render resolved world state and player intent.

## 15. Absolute Rules

- Do not require managed-athlete participation before simulating an event.
- Do not leave completed calendar events without champion data in new saves.
- Do not auto-play a due managed match that the user is supposed to control.
- Do not overwrite manually played managed results.
- Do not double-count ranking points, achievements, or match records.
- Do not make tournament homes depend on `career.activeEventId` for completed universe data.
- Do not fabricate legacy champions without either stored evidence or an explicit deterministic backfill source.
- Do not calculate player records from managed-player matches only.
- Do not put universe simulation inside React components.

## 16. Acceptance Criteria

- [ ] Advancing beyond a non-entered event's end date creates a completed universe event record.
- [ ] A skipped or missed competition still has champion, runner-up, entrants, scorelines, and match records.
- [ ] A managed-athlete early loss triggers or allows the rest of that event to complete without the managed athlete.
- [ ] Opening a completed non-entered tournament home shows event outcome data, not an empty fallback.
- [ ] Rankings update from all completed universe tournaments, not only managed-entered tournaments.
- [ ] Player profiles show records from universe matches where the managed athlete was not involved.
- [ ] Universe simulation is deterministic for the same save state and date.
- [ ] Running universe simulation twice for the same target date does not duplicate records or points.
- [ ] Old saves remain loadable and label unavailable legacy data honestly.
- [ ] Unit tests cover at least one entered event, one skipped/non-entered event, and one post-elimination event.

## 17. Verification

Run:

```bash
npm run test -- tests/unit/career.test.ts
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/player-profile.test.ts
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add focused tests for:

- `simulateUniverseThroughDate` completes overdue non-entered events,
- deterministic entrant/draw generation for skipped events,
- no duplicate match records after repeated simulation,
- no duplicate ranking rows after repeated simulation,
- managed-played result preservation,
- post-elimination bracket continuation,
- tournament home display for non-entered completed event,
- player profile record for a non-managed champion.

## 18. Definition Of Done

The career world feels larger than the user's direct matches:

$$
\text{Every event}
\rightarrow
\text{field}
\rightarrow
\text{matches}
\rightarrow
\text{champion}
\rightarrow
\text{rankings and records}
$$

The managed athlete is important because the user manages them, not because the universe refuses to exist without them.
