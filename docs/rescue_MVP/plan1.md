# Rescue MVP Plan 1: Schedule-Aware Career Calendar and Realistic Event Flow

Status: Draft technical brief  
Target project: `BadmintonManager`  
Builds on: `docs/rescue_MVP/plan0.md`  
Prepared on: 2026-05-16

## 1. Executive Summary

Plan 0 fixed the most visible navigation problem: the career `Advance Day` button is now global instead of trapped inside Calendar. Plan 1 should harden the game rules behind that button.

The new rule is:

$$
\text{Advance Day is allowed} \iff \text{there is no unplayed required match scheduled for today}
$$

If a player has an entered event and a match is scheduled for the current career date, the game must require that match to be played before the date can advance. This keeps the career calendar honest and prevents the player from silently skipping active competition obligations.

This plan also tightens the event model toward a more realistic badminton cadence:

- one managed main-draw round per event day
- next round after a win is scheduled on the following day
- entered events become playable through a clear calendar-to-match route
- Calendar becomes the single name for the page; remove `Event Desk` wording
- Calendar uses the full page and gains a `Past Events` sub-page for reflection, achievements, skipped events, and rewards

## 2. Current State From Code Inspection

### 2.1 Advance Day Is Global, But Not Yet Schedule-Aware

`app/App.tsx` now has `canAdvanceCareerDate(career, phase)` and the topbar label changes to `Advance Day` for normal career stages. The helper currently allows advancement when the career stage is one of:

```ts
"planning" | "event_entered" | "event_complete"
```

That is a good UI-level first pass, but it does not yet ask the deeper domain question: "is there an unplayed match scheduled for this date?"

The domain guard must live below the UI. Otherwise a future button, route, imported save, or direct store call could still advance past a match day.

### 2.2 Career Events Can Become Ambiguous After Entry

`enterCareerEvent(eventId)` sets:

- `activeEventId`
- `enteredEventIds`
- `stage: "pre_match"` if already on or after `event.startDate`
- otherwise `stage: "event_entered"`

It then calls `addCareerTournamentIfReady(...)`, which creates a tournament only when `career.stage === "pre_match"` and no tournament exists.

This means the intended flow is:

```text
enter event -> wait until start date -> create tournament -> pre-match -> play
```

The bug risk is that Calendar itself marks entered events as disabled with the button text `Entered`, so the player has no clear "Play Event" or "Open Match" affordance from the entered event card. The store may be ready, but the page communicates that the event is inert.

### 2.3 Current Post-Match Continuation Schedules Next Round Immediately

After a non-final career win, `continueCareerAfterPostMatch()` currently keeps the tournament active and sets:

```ts
stage: "pre_match"
phase: "overview"
```

That makes the next round immediately playable on the same date. The requested fix is to schedule the next round on the next career day, which better matches the way badminton main draws are experienced: round progression should feel like consecutive event days, not multiple full career matches stacked into the same day.

### 2.4 Calendar Naming And Layout Still Carry Old "Desk" Language

Several UI strings still say `Event Desk`, including:

- `Calendar / Event Desk`
- `Event Desk Brief`
- `Open Event Desk`
- `Event Desk`
- shell description text such as `Quick event desk`

The Calendar layout also splits content into multiple panels that feel like half-page or quarter-page usage. The requested direction is a fuller Calendar page with stronger information hierarchy and a dedicated `Past Events` sub-page.

## 3. Realism Target

The goal is not a full official tournament operations simulator. The goal is a close-enough badminton career abstraction:

$$
\text{entry deadline} \rightarrow \text{draw published} \rightarrow
\text{R16 day} \rightarrow \text{QF day} \rightarrow \text{SF day} \rightarrow \text{Final day}
$$

For the current 16-player draw, use one managed match round per day:

| Round | Suggested Date |
| --- | --- |
| `R16` | `event.startDate` |
| `QF` | `event.startDate + 1` |
| `SF` | `event.startDate + 2` |
| `F` | `event.startDate + 3` |

If the event has more duration days than four, extra days can be treated as travel, media, rest, draw, or finals buffer. If an event has fewer than four days, update the event catalog because the current 16-player career bridge needs at least four competition days.

This keeps the model simple:

$$
\text{scheduledMatchDate} = \text{event.startDate} + \text{roundOffset}
$$

## 4. Workstream Split

| Workstream | Owner Type | Primary Scope | Main Files | Risk |
| --- | --- | --- | --- | --- |
| A. Match-day advance gate | Store/domain engineer | Prevent date advancement when an unplayed match exists today | `game/store/store.ts`, `game/career/calendar.ts`, `app/App.tsx` | High |
| B. Next-day round scheduling | Tournament/career engineer | Make non-final wins wait until the next day | `game/store/store.ts`, `game/career/hubs.ts`, new schedule helper | High |
| C. Entered event playability | Career flow engineer | Make entered events clearly playable from Calendar and shell | `components/CareerWorkbench.tsx`, `app/App.tsx`, store tests | Medium |
| D. Past Events history | Data/model engineer | Persist played, skipped, and rewarded event records | `game/career/models.ts`, `game/store/save.ts`, `game/career/*` | High |
| E. Calendar rename and full-page layout | UI engineer | Rename page, remove `Event Desk`, rebuild Calendar layout and Past Events sub-page | `components/CareerWorkbench.tsx`, `styles.css`, docs/tests | Medium |
| F. Integration proof | QA engineer | Verify no date skipping, realistic schedule, event play flow, past records | `tests/unit/*`, `e2e/*` | Medium |

## 5. Issue A: Block `Advance Day` When A Match Is Due Today

### Problem

The UI now exposes `Advance Day` globally. That is correct, but the store must reject advancement if the player has an unplayed match scheduled for the current date.

### Desired Rule

If the career has:

- an active entered event,
- an active tournament,
- the managed player is still alive,
- the current managed match round is scheduled on or before `career.date`,
- and no completed live match has settled that round,

then `Advance Day` should be blocked and the app should route the player to the pre-match/bracket flow.

In short:

$$
\text{blockAdvance} =
\text{activeEvent} \land \text{entered} \land \text{matchDueToday} \land \text{unplayed}
$$

### Implementation Notes

Create a small schedule helper rather than scattering logic across React:

- `game/career/matchSchedule.ts`

Suggested helpers:

```ts
const roundOffsets: Record<RoundName, number> = {
  R16: 0,
  QF: 1,
  SF: 2,
  F: 3
};

export function scheduledDateForRound(event: CareerEventDefinition, round: RoundName) {
  return addDays(event.startDate, roundOffsets[round]);
}

export function currentManagedMatchSchedule(args: {
  career: CareerState;
  tournament: TournamentState | null;
}) {
  // return event, round, scheduledDate, dueToday, overdue, playable
}

export function canAdvanceCareerDay(args: {
  career: CareerState | null;
  tournament: TournamentState | null;
  liveMatchActive: boolean;
}) {
  // return { allowed: boolean; reason?: string; route?: "bracket" | "liveMatch" }
}
```

The store-level guard should run before `advanceCareerCalendar(state.career)` inside `advanceCareerDay()`.

If blocked:

- do not change `career.date`
- append a clear note, such as `Match day blocked: play Metro Open QF before advancing`
- set `career.stage` to `pre_match`
- preserve or create the tournament if the event is match-ready
- keep `phase: "overview"` unless a live match is already active

### Acceptance Criteria

- [ ] Clicking global `Advance Day` on a day with a due unplayed match does not change `career.date`.
- [ ] The app routes to the pre-match/bracket page when the blocked match can be played.
- [ ] A store-level call to `advanceCareerDay()` is also blocked; this is not only a React guard.
- [ ] The user sees an explanatory note/status message, not a silent no-op.
- [ ] No block occurs on rest/training days with no active match due.

### Verification

- [ ] Unit test: active entered event, date equals scheduled round date, no live match -> `advanceCareerDay()` leaves date unchanged.
- [ ] Unit test: same setup with no active tournament but event start date reached -> tournament is created and stage becomes `pre_match`.
- [ ] Component/E2E test: topbar `Advance Day` redirects to the pre-match hub when a match is due today.

### Dependencies

None, but this should land before next-day scheduling so the global button cannot skip the new waiting states.

## 6. Issue B: Schedule Next Round On The Following Day

### Problem

When the managed player wins a non-final career match, the next round currently becomes immediately playable. That compresses a tournament week into one date and makes the career calendar feel fake.

### Desired Behavior

After a non-final win:

```text
play R16 on 2026-06-03
win R16
post-match review remains on 2026-06-03
continue from review
career enters between-round waiting state
Advance Day to 2026-06-04
QF becomes playable
```

Repeat for `QF -> SF` and `SF -> F`. If the final is won, the event closes and rewards are settled; there is no next-day match.

### Model Recommendation

Add a career stage for clarity:

```ts
"between_rounds"
```

Updated stage meaning:

| Stage | Meaning |
| --- | --- |
| `planning` | No active entered event requiring immediate play |
| `event_entered` | Event is entered, but no match is playable today |
| `pre_match` | A scheduled match is playable now |
| `post_match` | A just-finished match must be reviewed/continued |
| `between_rounds` | The player won a non-final match and must advance to the next match date |
| `event_complete` | Event has ended or been closed |

If the team wants a smaller schema change, `event_entered` can be reused for between-round waiting. However, `between_rounds` is strongly recommended because it makes UI copy, tests, and save debugging much clearer.

### Store Flow

Update `continueCareerAfterPostMatch()`:

- If still in event and next managed round exists:
  - do not set `stage: "pre_match"` immediately
  - compute `nextRoundScheduledDate`
  - set `stage: "between_rounds"` or `event_entered`
  - keep `tournament`
  - keep `activeEventId`
  - set `lastPreMatchBrief` if useful, but do not mark match playable until the scheduled date
- If event is complete by loss or title:
  - close event as today
  - write past-event record
  - clear `activeEventId`

Update `advanceCareerCalendar(...)` or a wrapper around it:

- when date reaches the next scheduled round date, set `stage: "pre_match"`
- when date is before the next scheduled round date, remain in `between_rounds`

### Acceptance Criteria

- [ ] A non-final career win never exposes the next managed match on the same career date.
- [ ] `Continue To Next Round` after post-match review becomes a wait state, not immediate `pre_match`.
- [ ] Advancing one day after a non-final win opens the next round.
- [ ] This repeats consistently through R16, QF, SF, and F.
- [ ] Winning the final closes the event and does not create another scheduled match.
- [ ] Losing any round closes the event and writes the correct result.

### Verification

- [ ] Unit test: R16 win on `event.startDate`; continue review; date unchanged; stage is `between_rounds`; topbar says `Advance Day`.
- [ ] Unit test: advancing the next day after R16 win creates QF `pre_match`.
- [ ] Unit test: QF and SF follow the same one-day spacing.
- [ ] Unit test: final win closes event exactly once and does not schedule a phantom day.
- [ ] Existing reward settlement replay tests still pass.

### Dependencies

Depends on Issue A's schedule helper.

## 7. Issue C: Fix Entered Events That Cannot Be Played

### Problem

Entered event cards are disabled and say `Entered`, even when the event is at or near match day. The player needs an obvious path from Calendar into the playable event.

### Desired Calendar Actions

Each event card should expose one clear primary state:

| Event State | Primary Button |
| --- | --- |
| eligible and not entered | `Enter Event` |
| entered, before draw | `Entered` or `Await Draw` |
| entered, draw published, before first match | `View Draw` |
| match scheduled today | `Play Match` |
| between rounds, next match future date | `Next Match {date}` |
| post-match review pending | `Review Match` |
| completed | `View Result` |
| missed/skipped | `Skipped` or `Missed` |

The important change is that `entered` should no longer mean "dead disabled button." It should become a meaningful state in the flow.

### Implementation Notes

Add a UI mapper, either in `CareerWorkbench.tsx` or a small helper:

```ts
function eventActionForCareer(args: {
  career: CareerState;
  tournament: TournamentState | null;
  event: CareerEventDefinition;
}) {
  return {
    label: string,
    disabled: boolean,
    variant: "primary" | "secondary",
    action: "enter" | "openBracket" | "openReview" | "none"
  };
}
```

Route actions through existing page handlers:

- `Play Match` / `View Draw` -> `props.onOpenLiveMatch()` or bracket/pre-match route
- `Review Match` -> `props.onOpenPostMatch()`
- `View Result` -> Past Events sub-page once Issue D lands
- `Enter Event` -> `props.onEnterEvent(event.id)`

Also audit `activeEvent(...)` in `CareerWorkbench.tsx`. It currently returns `activeEventId` if present, otherwise `getNextEvent`. That is okay, but Calendar should distinguish active entered event from next unentered event so the page does not describe an already-entered event as if it still needs entry.

### Acceptance Criteria

- [ ] After entering an event, the event card communicates the next step instead of only showing disabled `Entered`.
- [ ] On match day, the active event card has a visible `Play Match` or `Open Match` action.
- [ ] Entering an event on its start date immediately creates the career tournament and opens the playable pre-match path.
- [ ] Entering an event before start date allows normal day advancement until the scheduled match date.
- [ ] Event cards for completed/skipped events lead to history, not entry.

### Verification

- [ ] Unit/component test: entered future event card shows `Await Draw` or `Next Match`.
- [ ] Unit/component test: entered current-date event card shows `Play Match`.
- [ ] Store test: entering on start date produces `tournament !== null`, `stage === "pre_match"`.
- [ ] E2E test: start career -> enter event -> advance to start date -> click `Play Match`.

### Dependencies

Should use the schedule helper from Issue A.

## 8. Issue D: Add `Past Events` History

### Problem

Calendar has no reflective history surface. The player cannot easily see what events they played, what they achieved, what they skipped, and what rewards they received.

### Desired Behavior

Add a `Past Events` sub-page under Calendar. It should show:

- event name, tier, location, and dates
- status: champion, runner-up, semi-finalist, quarter-finalist, R16 exit, skipped, missed deadline, withdrawn if later implemented
- score/result summary where available
- ranking points earned
- prize money earned
- entry and travel costs paid
- net event economy
- achievement tags, such as `First Title`, `Career Best`, `Upset Win`, `Finalist`

The history view should make past activity legible:

$$
\text{event memory} = \text{result} + \text{reward} + \text{cost} + \text{context}
$$

### Data Model Recommendation

Add persistent event history to `CareerState`:

```ts
export const careerEventHistoryRecordSchema = z.object({
  eventId: z.string(),
  eventName: z.string(),
  tier: careerTierSchema,
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum([
    "champion",
    "runner_up",
    "semi_final",
    "quarter_final",
    "round_of_16",
    "skipped",
    "missed_deadline",
    "withdrawn"
  ]),
  entered: z.boolean(),
  resultRound: z.string().nullable(),
  pointsAwarded: z.number().int().nonnegative(),
  prizeMoney: z.number().int().nonnegative(),
  entryCost: z.number().int().nonnegative(),
  travelCost: z.number().int().nonnegative(),
  netCash: z.number().int(),
  completedAt: z.string(),
  matchIds: z.array(z.string()),
  scorelines: z.array(z.string()),
  achievements: z.array(z.string())
});
```

Then extend `careerStateSchema` with:

```ts
eventHistory: z.array(careerEventHistoryRecordSchema)
```

This is a save-affecting change. It should bump the career schema version and persisted save version, then migrate older saves with `eventHistory: []`.

### Recording Rules

Write records in three places:

1. `settleCareerMatch(...)` or the store layer after final/loss closeout:
   - record played result
   - include points and prize deltas
   - include scorelines from `tournament.managedResults`
2. `advanceCareerDay()` reconciliation:
   - when an unentered event is fully in the past, record `skipped` or `missed_deadline`
3. Future withdrawal flow:
   - reserve `withdrawn`, but do not implement withdrawal unless it already exists

Avoid duplicate records:

```ts
if (career.eventHistory.some((record) => record.eventId === event.id)) {
  return career;
}
```

### Past Events UI

Implement Calendar sub-navigation:

```text
Calendar
[Upcoming] [Past Events]
```

`Past Events` should be a full-page table/list, not a tiny side panel.

Suggested columns/cards:

- Date
- Event
- Tier
- Result
- Points
- Prize
- Costs
- Net
- Achievements

### Acceptance Criteria

- [ ] Completed events create exactly one `eventHistory` record.
- [ ] Skipped/missed past events appear in history with zero rewards.
- [ ] Past Events shows rewards and costs, not only event names.
- [ ] Final win, non-final loss, and skipped event are visually distinct.
- [ ] Importing older saves initializes `eventHistory` safely.
- [ ] Ranking `eventHistory` and career `eventHistory` do not contradict each other.

### Verification

- [ ] Save migration test for older career version -> `eventHistory: []`.
- [ ] Store test for final win record.
- [ ] Store test for loss record.
- [ ] Store test for skipped event record after date passes event end.
- [ ] Component test for Past Events table/list.
- [ ] E2E test enters one event, completes/forces a result, then sees it under Past Events.

### Dependencies

Can start after Issue B clarifies closeout timing. UI can be developed with fixture records in parallel once the schema is agreed.

## 9. Issue E: Rename `Calendar / Event Desk` To `Calendar`

### Problem

The naming is too busy and inconsistent. The page should simply be `Calendar`.

### Required Text Changes

Remove player-facing `Event Desk` wording from runtime UI:

- `Calendar / Event Desk` -> `Calendar`
- `Calendar / Event Entry` -> `Calendar`
- `Event Desk Brief` -> `Schedule Brief` or `Current Event`
- `Open Event Desk` -> `Open Calendar`
- `Event Desk` button -> `Calendar`
- shell description `Quick event desk` -> `Quick tournament` or `Calendar`

Documentation can mention older names only as historical context, but active product docs and tests should use `Calendar`.

### Acceptance Criteria

- [ ] No runtime UI text says `Event Desk`.
- [ ] Calendar page H1 is exactly `Calendar`.
- [ ] Tests look for `Calendar`, not `Calendar / Event Desk`.
- [ ] Sidebar and home cards consistently use `Calendar`.

### Verification

- [ ] `rg -n "Event Desk|event desk|Calendar / Event" app components tests docs/product docs/plans`.
- [ ] Component tests updated.
- [ ] E2E selectors updated.

### Dependencies

None. This can run in parallel with the data work, but coordinate with Issue E layout edits to avoid conflicts in `CareerWorkbench.tsx`.

## 10. Issue F: Full-Page Calendar Layout

### Problem

Calendar currently reads as a collection of stacked panels that do not fully use available horizontal space. The event list and briefing content compete for small areas instead of creating one strong operational calendar.

### Desired Layout

Use a full-page hierarchy:

```text
Calendar
[Upcoming] [Past Events]

Top status row:
Today | Active event | Next match | Readiness | Deadline

Primary calendar area:
[full-width event timeline / week strip / current event]

Main content:
[large event schedule table or cards using full width]

Secondary:
[deadline milestones / seeding / eligibility / costs]
```

The page should use the width intentionally:

$$
\text{Calendar value} = \text{timeline clarity} + \text{next action clarity} + \text{history recall}
$$

### Implementation Notes

Replace or revise `career-calendar-grid` so it does not default into half-width sections.

Potential CSS direction:

```css
.career-calendar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
}

.calendar-event-table {
  display: grid;
  grid-template-columns: minmax(14rem, 1.2fr) repeat(6, minmax(7rem, 0.7fr)) minmax(9rem, 0.8fr);
}
```

Keep mobile/narrow behavior as single-column, but desktop should feel like the primary format.

### Acceptance Criteria

- [ ] Calendar uses one full-page layout, not quartered fragments.
- [ ] Upcoming and Past Events are both reachable from the top of the page.
- [ ] Active/next event and due match are immediately visible.
- [ ] Event cards or rows expose action buttons without burying them.
- [ ] No text overlap at `1366 x 768`, `1440 x 900`, and a mobile viewport.

### Verification

- [ ] Playwright screenshot at `1440 x 900`.
- [ ] Playwright screenshot at `1366 x 768`.
- [ ] Playwright screenshot at mobile width.
- [ ] Manual check: event entry, match-ready, between-round, completed, and skipped states.

### Dependencies

Coordinate with Issues C, D, and E.

## 11. Issue G: Align Event Catalog With Realistic Badminton Cadence

### Problem

The current event catalog has useful deadlines and durations, but the playable career bridge needs those dates to match the one-round-per-day main-draw model.

### Required Checks

For every current event:

- `durationDays >= 4` for a 16-player draw
- `drawDate < startDate`
- `entryDeadline < drawDate`
- `rankingCutoffDate <= seedingDate <= drawDate`
- `withdrawalDeadline <= drawDate` unless intentionally allowing late withdrawal
- there is enough spacing between events for travel and recovery

Suggested invariant:

$$
\text{entryDeadline} \le \text{withdrawalDeadline} \le \text{drawDate} < \text{startDate}
$$

This does not need to mimic a specific official calendar. It should merely feel like a plausible badminton circuit.

### Acceptance Criteria

- [ ] Every career event can schedule R16, QF, SF, and F on separate dates.
- [ ] Event deadlines appear in a realistic order.
- [ ] Calendar copy distinguishes entry deadline, draw publication, and match start.
- [ ] The first event is playable soon enough that a new career does not feel idle.
- [ ] Later events leave enough recovery/training space to make `Advance Day` meaningful.

### Verification

- [ ] Add a unit test over `careerEventCatalog` asserting date-order invariants.
- [ ] Add a unit test over `careerEventCatalog` asserting `durationDays >= 4`.
- [ ] Manual review of Calendar at start-of-career and after one event completion.

### Dependencies

Can run in parallel with Issue A, but any date changes must be coordinated with tests that use fixed event dates.

## 12. Implementation Order

### Phase 1: Domain Guard First

1. Add schedule helper for round dates and match-due detection.
2. Add store-level `advanceCareerDay()` guard.
3. Update `canAdvanceCareerDate(...)` to consult the same domain gate or a UI-safe projection of it.

Checkpoint:

- [ ] `Advance Day` cannot skip a match due today.
- [ ] Existing Plan 0 shell tests still pass after updates.

### Phase 2: Realistic Round Cadence

4. Add `between_rounds` stage or equivalent waiting state.
5. Update post-match continuation after non-final wins.
6. Advance from waiting state into next scheduled pre-match only on the following date.

Checkpoint:

- [ ] R16, QF, SF, and F can each happen on separate career dates.
- [ ] Final win/loss closeout still settles exactly once.

### Phase 3: Event Playability And Calendar UI

7. Add calendar event action mapper.
8. Replace inert `Entered` cards with `View Draw`, `Play Match`, `Next Match`, or `Review Match`.
9. Rename the page and remove all runtime `Event Desk` language.
10. Rework Calendar into a full-width page.

Checkpoint:

- [ ] Entered events are clearly playable.
- [ ] Calendar naming is clean.
- [ ] Desktop layout uses the page width.

### Phase 4: Past Events

11. Add career event history schema and migration.
12. Record played, completed, and skipped events.
13. Add the `Past Events` Calendar sub-page.

Checkpoint:

- [ ] Past Events shows achievements and rewards.
- [ ] Older saves import without data loss.

### Phase 5: Proof

14. Add catalog invariant tests.
15. Add store tests for date gating and round scheduling.
16. Add component/E2E tests for Calendar actions and Past Events.
17. Run full verification.

## 13. Regression Matrix

| Flow | Expected Result |
| --- | --- |
| New career, no event entered | `Advance Day` increments date normally |
| Event entered before start | `Advance Day` works until first match date |
| Event entered, match due today | `Advance Day` is blocked and opens pre-match path |
| Enter event on start date | Tournament is created and `Play Match` is available |
| Win R16 | Next match is QF on the next career date |
| Win QF | Next match is SF on the next career date |
| Win SF | Next match is Final on the next career date |
| Win Final | Event closes, rewards settle once, Past Events records champion |
| Lose any round | Event closes, Past Events records exit round |
| Skip event | Past Events records skipped/missed with zero reward |
| Import old save | New schedule/history fields hydrate safely |

## 14. Likely Files

- `app/App.tsx`
- `app/pages.ts`
- `components/CareerWorkbench.tsx`
- `game/career/calendar.ts`
- new `game/career/matchSchedule.ts`
- `game/career/events.ts`
- `game/career/hubs.ts`
- `game/career/models.ts`
- `game/career/state.ts`
- `game/store/save.ts`
- `game/store/store.ts`
- `styles.css`
- `tests/unit/app-career-shell.test.tsx`
- `tests/unit/career.test.ts`
- `tests/unit/career-calendar-ranking.test.ts`
- `tests/unit/save-migration.test.ts`
- `e2e/app.spec.ts`
- `docs/reference/career-calendar-ranking.md`
- `docs/plans/active/project-status.md`

## 15. Verification Commands

Run focused tests while developing:

```bash
npm run test -- tests/unit/career.test.ts
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/save-migration.test.ts
```

Finish with:

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## 16. Out Of Scope

Do not include these in this pass:

- Expanding beyond the existing 16-player career tournament bridge.
- Adding qualifying rounds.
- Adding doubles.
- Adding real licensed tournament names or athlete likenesses.
- Rebalancing match engine probabilities.
- Adding backend calendars or cloud sync.

## 17. Open Decisions

1. Should `between_rounds` be added as a formal career stage, or should `event_entered` cover waiting between rounds?
2. Should skipped events be recorded when entry deadline passes or only after the event end date passes?
3. Should Past Events include every skipped event, or only events that were entered or explicitly skipped by the player?
4. Should Calendar sub-pages be local tabs inside `CareerCalendarPage`, or typed app pages such as `{ id: "calendarPast" }`?

My recommendation:

- Add a formal `between_rounds` stage.
- Record skipped events after event end date, not immediately after deadline, so the calendar does not feel punitive too early.
- Show all past entered/completed events and major skipped circuit events, but keep low-importance skipped events visually subdued.
- Use Calendar tabs first; add typed pages later only if URL/deep-link behavior becomes a product goal.
