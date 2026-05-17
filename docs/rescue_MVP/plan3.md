# Rescue MVP Plan 3: Calendar, Competition Entry, And Start-Shell Cleanup

Status: Draft technical brief
Target project: `BadmintonManager`
Builds on: `docs/rescue_MVP/plan0.md`, `docs/rescue_MVP/plan1.md`, `docs/rescue_MVP/plan2.md`
Source notes: `docs/rescue_MVP/Scratch3.md`
Prepared on: 2026-05-18

## 1. Executive Summary

Plan 3 is about making the MVP career shell feel predictable enough that another engineer can test it without guessing what the game meant to do. The core failure pattern is simple: the interface sometimes says an event is entered, but the player is not reliably routed into that competition. Calendar rows also keep old events in the way, `View Entry` does not open anything meaningful, the start screen still lives inside the career command shell, and the left sidebar carries debug-era context controls that no longer serve the player.

The target rule is:

$$
\text{Entered Event} + \text{Current Date} \geq \text{Event Start Date}
\Rightarrow \text{Playable Match Route Exists}
$$

For this rescue slice, favor testability over long-term simulation strictness. Most event locks should be removed until the event flow is proven across many calendar entries. Only `Summit Invitational` and `Continental Premier` should keep meaningful eligibility gates during this stage. `Season Finals` should be moved to week 52, and the mid-season gap should be filled with additional fictional events so the calendar has enough data to exercise paging, past-event movement, and repeated entry-to-match loops.

## 2. Current Code Findings

The relevant implementation is concentrated in these files:

| Area | Current Files |
| --- | --- |
| Career event catalog and eligibility | `game/career/events.ts` |
| Event schedule and daily action resolver | `game/career/matchSchedule.ts`, `game/career/dailyAction.ts` |
| Store actions for entry, date advance, and match opening | `game/store/store.ts` |
| Calendar UI and portal UI | `components/CareerWorkbench.tsx` |
| Start screen and athlete selection | `components/SetupView.tsx` |
| Shell, topbar, sidebar, routing | `app/App.tsx`, `app/pages.ts` |
| Existing tests | `tests/unit/career.test.ts`, `tests/unit/career-daily-action.test.ts`, `tests/unit/app-career-shell.test.tsx`, `tests/unit/setup-view.test.tsx`, `e2e/app.spec.ts` |

Important observations:

- `currentManagedMatchSchedule(...)` is centered on `career.activeEventId`. If multiple events are entered or if an older entered event is no longer active, schedule resolution can miss the event the player is trying to open.
- `CareerCalendarPage` passes an event id through `props.onOpenScheduledCareerMatch(action.eventId)`, but `app/App.tsx` currently defines `handleOpenScheduledCareerMatch()` without accepting that id, and the store action `openScheduledCareerMatch` also has no event-id parameter.
- `View Entry` and `View Draw` currently call `props.onOpenCalendar()` from inside the Calendar page. In practical terms, the button can be a no-op.
- Past-event persistence exists through `career.eventHistory` and `recordPastCareerEvents(...)`, but the Calendar `Past Events` tab still renders a placeholder that says the archive model is pending.
- The start screen is rendered inside the same `TopStatusBar` plus `CommandSidebar` shell used after a career/save exists. This is the opposite of the requested Football Manager-style standalone start screen.
- `CommandSidebar` still renders `Active Command`, quick tactic controls, and managed athlete details at the bottom. The Scratch3 request explicitly removes those blocks.

## 3. Product Rules For This Slice

### 3.1 Event Entry Must Be Deterministic

For every unlocked catalog event:

$$
\text{can enter} \land \text{entered} \land \text{date in event window}
\Rightarrow \text{pre-match hub can be opened}
$$

No entered event should leave the player stranded on a `View Entry`, `Entered`, or inert Calendar button.

### 3.2 Calendar Space Must Be Bounded

The Calendar should treat current/future and past events as separate datasets:

$$
\text{Upcoming} = \{e \mid \text{career.date} \leq \text{event.endDate}\}
$$

$$
\text{Past} = \{e \mid \text{career.date} > \text{event.endDate}\}
$$

Each Calendar tab should show at most five records per page:

$$
\text{visibleEvents} = \text{events.slice}(5p, 5p + 5)
$$

where \(p\) is the zero-based page index.

### 3.3 Start Screen Must Be Outside The Career Shell

When no save is loaded and no quick tournament is running, the player should see only the launch screen. The topbar, sidebar, resize handle, career athlete status, tactic stack, and global continue action should not exist yet.

## 4. Workstream Split

| Workstream | Owner Type | Primary Scope | Main Files | Risk |
| --- | --- | --- | --- | --- |
| A. Event entry determinism | Store/domain engineer | Make every entered due event route into a playable match | `game/career/matchSchedule.ts`, `game/career/dailyAction.ts`, `game/store/store.ts` | High |
| B. Calendar paging and past movement | UI/domain engineer | Move expired events out of Upcoming and render five per page | `components/CareerWorkbench.tsx`, `game/career/events.ts`, `styles.css` | High |
| C. Sidebar cleanup | Shell UI engineer | Remove the lower context/tactic/athlete blocks from the sidebar | `app/App.tsx`, `styles.css` | Low |
| D. Debug-friendly event catalog | Career content engineer | Remove most locks, move Finals to week 52, add fictional events | `game/career/events.ts`, save migration tests if needed | Medium |
| E. Calendar entry/details routing | App routing engineer | Make `View Entry` and `View Draw` open an actual page/state | `app/pages.ts`, `app/App.tsx`, `components/CareerWorkbench.tsx` | Medium |
| F. Portal continue cleanup | Career UI engineer | Remove the green in-page `Continue` button from Portal Home | `components/CareerWorkbench.tsx` | Low |
| G. Standalone start screen | Shell/setup engineer | Render setup outside the command shell until a save/run exists | `app/App.tsx`, `components/SetupView.tsx`, `e2e/app.spec.ts` | High |

## 5. Issue A: Match Entry Fails For Some Events

### Problem

Scratch3 reports that competition entry protection is inconsistent. The user specifically observed that `Metro Open` and `National Command Championship` can fail to route into competition, while other events such as `Harbor Masters` and `Academy Select Invitational` appear to work.

The exact event names in code are:

| Catalog Order | Event ID | Event Name | Current Week |
| --- | --- | --- | --- |
| 1 | `metro-open-300` | `Metro Open` | 23 |
| 2 | `harbor-masters-500` | `Harbor Masters` | 24 |
| 3 | `summit-invitational-750` | `Summit Invitational` | 26 |
| 4 | `continental-premier-1000` | `Continental Premier` | 28 |
| 5 | `national-command-championship` | `National Command Championship` | 30 |
| 6 | `academy-select-invitational` | `Academy Select Invitational` | 31 |
| 7 | `season-finals` | `Season Finals` | 34 |

### Likely Failure Sources

1. Event schedule resolution is active-event centered. `currentManagedMatchSchedule(...)` only considers `career.activeEventId`.
2. Calendar row actions pass `eventId`, but the app/store open action currently ignores it.
3. `View Entry` is not a real route and can leave the user on the same Calendar page.
4. If the player enters multiple future events, later entries can overwrite `activeEventId`, causing an earlier due event to be entered but not playable.
5. Tournament creation only happens when career stage is `pre_match`; a due entered event can remain stuck in `event_entered` if activation is not synchronized with date advancement.

### Implementation Requirements

Add event-scoped schedule resolution. The contractor may extend the current helper or add a new helper, but React must not duplicate this logic.

Suggested contracts:

```ts
export function managedMatchScheduleForEvent(args: {
  career: CareerState;
  tournament: TournamentState | null;
  eventId: string;
}): ManagedMatchSchedule | null;

export function nextDueEnteredEvent(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): CareerEventDefinition | null;

export function activateDueEnteredEvent(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): CareerState;
```

Rules:

- If there is an active tournament, the only playable event is that tournament's event until it is completed or the managed player is eliminated.
- If no tournament is active, choose the earliest entered, uncompleted event whose `event.startDate <= career.date <= event.endDate`.
- If multiple entered events are overdue, choose the earliest `startDate` first and add a career note naming the chosen event.
- `openScheduledCareerMatch(eventId)` must accept an optional event id all the way from `CareerCalendarPage` to the store.
- Opening a due event by id should set `career.activeEventId = eventId`, set `stage = "pre_match"`, create the tournament if missing, and route to the pre-match hub.
- The daily topbar resolver should continue to use the same underlying schedule helper, so topbar and Calendar cannot disagree.

### Failing Symptoms

- Clicking an entered `Metro Open` row does not open `Opponent Briefing`.
- Clicking an entered `National Command Championship` row leaves the player on Calendar.
- The row shows `View Entry`, `Entered`, `Draw Published`, or another passive label after the event has started.
- `career.enteredEventIds` contains the event id, but `career.activeEventId` points somewhere else and no match is playable.
- `tournament` is `null` even though the current date is inside an entered event window.
- Topbar says `Advance Day` when an entered event has a due unplayed match.
- The player can advance past the first match day of an entered event without playing or intentionally skipping it.

### Passing Symptoms

- Every unlocked event can be entered, advanced to its start date, and opened into `Opponent Briefing`.
- Calendar row label becomes `Play {Event Name} R16` when an entered event reaches its start date.
- The red topbar daily action matches the same due event shown in Calendar.
- `openScheduledCareerMatch(eventId)` routes to the selected due event, not whichever event was last assigned to `activeEventId`.
- Store state after opening contains `career.stage === "pre_match"`, `career.activeEventId === eventId`, and `tournament?.id === eventId`.
- The match can proceed from `Opponent Briefing` to live match and then post-match review.

### Verification

Add a table-driven unit test over all events that are meant to be unlocked:

```ts
it.each(unlockedEventIds)("opens entered due event %s", (eventId) => {
  // create career
  // set date before entry deadline
  // enter event
  // set/advance date to event.startDate
  // call openScheduledCareerMatch(eventId)
  // expect pre_match, activeEventId, tournament id, pre-match brief
});
```

Also add regression coverage where two future events are entered, then the earlier one becomes due first. The earlier event must win routing.

## 6. Issue B: Past Events Occupy Upcoming Calendar Space

### Problem

Past events should not continue to occupy Upcoming schedule rows after their event window has fully ended. Once:

$$
\text{career.date} > \text{event.startDate} + \text{event.durationDays} - 1
$$

the event belongs in `Past Events`, not the future/current schedule list.

The existing `Past Events` tab is currently a placeholder even though `career.eventHistory` already exists.

### Implementation Requirements

Create small selector helpers near the event/calendar domain layer:

```ts
export function eventEndDate(event: CareerEventDefinition): string;

export function upcomingCalendarEvents(career: CareerState): CareerEventDefinition[];

export function pastCalendarRecords(career: CareerState): CareerEventHistoryRecord[];
```

The UI should then:

- Render Upcoming from `upcomingCalendarEvents(career)`, sorted by `startDate` ascending.
- Render Past Events from `career.eventHistory`, sorted by `endDate` or `completedAt` descending.
- Call or rely on `recordPastCareerEvents(...)` during day advancement so missed/skipped events become history records.
- Page each tab independently with five items per page.
- Reset the page index to `0` when switching tabs.
- Disable `Previous` on page 1 and `Next` on the last page.
- Show a compact page count such as `Page 1 of 3`.

### Failing Symptoms

- `Metro Open` is still visible in Upcoming after the career date is later than its end date.
- Upcoming grows indefinitely as the catalog grows.
- The Past Events tab says the archive model is pending even after event history records exist.
- The player cannot inspect skipped, missed, or completed events from the Calendar.
- Pagination controls are missing when there are more than five upcoming or past records.
- Page controls move both tabs at once or keep an invalid page index after switching tabs.

### Passing Symptoms

- Upcoming shows only current and future events.
- Past Events lists completed, skipped, and missed records from `career.eventHistory`.
- Each tab shows at most five records at a time.
- Past records include useful information already present in the model: event name, tier, dates, status, result round, points, prize money, entry cost, travel cost, net cash, scorelines, and achievements.
- Page controls are keyboard-accessible buttons with clear disabled states.
- Calendar remains bounded on desktop and mobile.

### Verification

Add unit tests for selectors:

- A career dated after `Metro Open` end date excludes it from upcoming.
- `recordPastCareerEvents(...)` creates a `missed_deadline` record for an unentered expired event.
- Past records sort newest first.
- Pagination returns exactly five records per full page.

Add UI tests in `app-career-shell.test.tsx`:

- With six future events, Upcoming renders five event rows and `Next` reveals the sixth.
- With six history records, Past Events renders five records and pages to the older record.

## 7. Issue C: Remove Bottom Content From Left Sidebar

### Problem

The left sidebar currently renders debug/context controls that Scratch3 explicitly asks to remove:

- `Active Command`
- the active command label and description, such as `Calendar`
- date/readiness/state text, such as `State: pre match`
- `Go Live`
- `Tactic`
- selected tactic label, such as `Balanced Control`
- tactic shortcut buttons, such as `Aggressive Smash`, `Spread Court`, `Defensive Wall`
- `Managed Athlete`
- athlete identity, such as `Grand-Slam Southpaw`
- nationality/style text, such as `CHN - Fearless Net Assassin`

### Implementation Requirements

In `app/App.tsx`, simplify `CommandSidebar` so it renders:

- brand/collapse control,
- primary command navigation,
- resize handle only if the sidebar remains resizable.

Remove props that become unused:

- `activeAthlete`
- `canEnterManagedMatch`
- `phaseLabel`
- `selectedTacticLabel`
- `plannedTacticKey`
- `onChooseTactic`
- `onOpenPlayerProfile`
- `onStartManagedMatch`

Then delete or simplify CSS for the removed blocks:

- `.sidebar-options`
- `.sidebar-tactic-stack`
- `.sidebar-athlete`
- collapsed-state rules that target those blocks.

Do not remove the real tactic planning page or match controls. Only remove sidebar shortcuts.

### Failing Symptoms

- The bottom sidebar still shows `Active Command`.
- The sidebar still shows tactic buttons.
- The sidebar still shows managed athlete name/nationality/style.
- Removed sidebar controls still appear in collapsed mode through tooltips, hidden overflow, or layout gaps.
- TypeScript reports unused props after the cleanup.

### Passing Symptoms

- Sidebar contains only navigation, brand/collapse, and resize behavior.
- No duplicate or stale match/tactic controls remain in the left rail.
- Match entry remains available through topbar daily action, Calendar rows, and pre-match page actions.
- `npm run typecheck` passes without unused or incompatible prop errors.

### Verification

Update shell tests to assert the removed labels are absent when a career is loaded:

```ts
expect(screen.queryByText("Active Command")).not.toBeInTheDocument();
expect(screen.queryByText("Tactic")).not.toBeInTheDocument();
expect(screen.queryByText("Managed Athlete")).not.toBeInTheDocument();
```

## 8. Issue D: Make The Event Catalog Debug-Friendly

### Problem

The MVP is not ready for heavy competition locks. Event entry needs broad test coverage before rank, points, readiness, and completed-event gates become strict. Scratch3 requests:

- remove locks from all competitions except `Summit Invitational` and `Continental Premier`;
- move `Season Finals` from week 34 to week 52;
- create new fictional competitions to fill the gap so more competitions can be tested.

### Implementation Requirements

Update `careerEventCatalog` in `game/career/events.ts`.

For all events except `summit-invitational-750` and `continental-premier-1000`, use this MVP eligibility:

```ts
eligibility: {
  minRank: null,
  minPoints: null,
  readinessFloor: 0,
  minCompletedEvents: null
}
```

Keep `Summit Invitational` and `Continental Premier` gated so the UI still has examples of locked competitions.

Move `Season Finals` to week 52. Suggested date packet:

| Field | Suggested Value |
| --- | --- |
| `weekNumber` | `52` |
| `startDate` | `2026-12-23` |
| `durationDays` | `6` |
| `entryDeadline` | `2026-12-12` |
| `rankingCutoffDate` | `2026-12-08` |
| `seedingDate` | `2026-12-10` |
| `withdrawalDeadline` | `2026-12-14` |
| `drawDate` | `2026-12-20` |

Add fictional events between Academy Select and Season Finals. Suggested minimum set:

| Event ID | Name | Tier | Week | Start Date | Duration | Lock Policy |
| --- | --- | --- | --- | --- | --- | --- |
| `coastline-classic-300` | `Coastline Classic` | `Circuit 300` | 33 | `2026-08-13` | 4 | unlocked |
| `lakeside-sprint-300` | `Lakeside Sprint` | `Circuit 300` | 36 | `2026-09-03` | 4 | unlocked |
| `ember-city-open-500` | `Ember City Open` | `Circuit 500` | 39 | `2026-09-24` | 5 | unlocked |
| `northern-lights-challenge-500` | `Northern Lights Challenge` | `Circuit 500` | 42 | `2026-10-15` | 5 | unlocked |
| `meridian-autumn-masters-750` | `Meridian Autumn Masters` | `Circuit 750` | 45 | `2026-11-05` | 5 | unlocked |
| `crownbridge-warmup-invitational` | `Crownbridge Warmup Invitational` | `Invitational` | 48 | `2026-11-26` | 4 | unlocked |

Use existing events as templates for prize money, ranking points, costs, and `stakesLabel`. Avoid introducing real tournament names.

### Failing Symptoms

- New careers still show locks on `Metro Open`, `Harbor Masters`, `National Command Championship`, `Academy Select Invitational`, or `Season Finals`.
- `Season Finals` still appears at week 34 or in August 2026.
- There is a large empty calendar gap from early August to late December.
- New event IDs collide with existing IDs.
- Save migration/hydration overwrites the new catalog details incorrectly.

### Passing Symptoms

- Only `Summit Invitational` and `Continental Premier` show meaningful tier/readiness/rank/points locks.
- `Season Finals` appears in week 52 with December dates.
- The calendar has enough events to require pagination.
- New events can be entered and opened into matches under the same deterministic flow as existing unlocked events.
- Existing saves hydrate safely to the updated catalog metadata.

### Verification

Add tests:

- `careerEventCatalog` has unique IDs.
- Catalog is sorted by `startDate`.
- Only `summit-invitational-750` and `continental-premier-1000` have non-zero/non-null eligibility locks.
- `season-finals.weekNumber === 52`.
- A new career contains more than five future events, which exercises Calendar paging.

## 9. Issue E: `View Entry` Does Nothing

### Problem

In `CareerCalendarPage`, the `open_draw` action currently calls `props.onOpenCalendar()`. Since the player is already on Calendar, `View Entry` can feel broken.

### Implementation Options

Choose one of these two approaches. Option 1 is preferred because it gives the button a real destination.

#### Option 1: Add Event Details Route

Add an app page:

```ts
| { id: "eventDetails"; eventId: string }
```

Then implement an event details panel/page that shows:

- event name, tier, week, location, dates,
- status and entered/completed state,
- eligibility and cost details,
- deadlines,
- seed snapshot,
- current action: enter, play match, review, completed, or blocked.

`View Entry` and `View Draw` should route to this page with the event id.

#### Option 2: Inline Expand Event Row

If a new route is too much for this rescue slice, make `View Entry` toggle an expanded details state keyed by event id. The row should visibly change, focus should stay within the row, and the button label should become `Hide Entry`.

### Failing Symptoms

- Clicking `View Entry` does not visibly change anything.
- The button only calls `onOpenCalendar`.
- The action has no testable route, expanded state, or accessible region.
- The label says `View Draw`, but no draw/seed/entry details appear.

### Passing Symptoms

- Clicking `View Entry` opens a details page or expands an event details section.
- The details include deadlines, eligibility, costs, seeded snapshot, and next possible action.
- `View Draw` becomes available only when draw information is relevant and shows draw/seed context.
- The action is covered by a unit test that fails if the button is a no-op.

### Verification

Add a UI test:

```ts
fireEvent.click(screen.getByRole("button", { name: "View Entry" }));
expect(screen.getByRole("heading", { name: /Metro Open|Event Details/ })).toBeInTheDocument();
```

If using inline expansion, assert that the expanded region appears and is associated with the event row.

## 10. Issue F: Remove Green Continue Button From Portal Main Page

### Problem

The global topbar already owns the daily `Advance Day` / `Play Match` / `Review Match` action. The green in-page `Continue` button on `CareerHomePage` creates a second primary continue command and can confuse the player.

Current location: `components/CareerWorkbench.tsx`, inside the `CareerHomePage` header meta block.

### Implementation Requirements

Remove the in-page `Continue` button from Portal Home:

```tsx
<button className="command-button command-button-primary" ...>
  Continue
</button>
```

After removal, the header meta block should still show useful status chips such as cash, readiness, and career stage. The only global continue/daily action should be in the topbar after a career save exists.

### Failing Symptoms

- Portal Home still shows a green `Continue` button in the page header.
- The page has two primary continue actions: one in the topbar and one in the content.
- The in-page `Continue` routes differently from the topbar daily action.

### Passing Symptoms

- Portal Home header has no `Continue` button.
- The topbar is the only global daily action after entering the career shell.
- Existing specific action buttons remain available: Calendar, Training Desk, Program Hub, Circuit Room, Match Planning.

### Verification

Add a `CareerHomePage` render test:

```ts
expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
```

If the topbar is present in an app-level test, scope the query to the Portal Home main region so the test does not accidentally reject the topbar action.

## 11. Issue G: Start Page Must Be Standalone, And Browse All Athletes Must Work

### Problem

Scratch3 requests a start page like a sports management game: before any save/run exists, there should be no sidebar and no topbar. The current app renders `SetupView` inside the same command shell as the career workspace.

The user also reported that `Browse All Athletes` did not work during new save creation, likely because it was inside a constrained modal. Current code has improved the modal, but the handoff should still require a robust full-roster selection path.

### Implementation Requirements

In `app/App.tsx`, introduce a shell gate:

```ts
const shouldRenderStandaloneStart =
  activePage.id === "setup" &&
  !activeSavePresent &&
  !career &&
  !tournament &&
  !liveMatch;
```

When this is true:

- render `SetupView` directly,
- do not render `TopStatusBar`,
- do not render `CommandSidebar`,
- do not render `.workspace-shell`,
- keep `SettingsOverlay` and `ConfirmOverlay` accessible through start-screen buttons only if needed.

When a save exists or a quick tournament/career starts, render the normal command shell.

For Browse All Athletes:

- The button should be visible after opening the athlete selection modal.
- It should open a full-roster area that is not clipped on desktop or mobile.
- The user must be able to search, filter, select an athlete, and confirm.
- Confirmation must stay disabled until an explicit athlete selection is made.
- Starting a career must persist `career.program.managedPlayerId` as the confirmed athlete id.

### Failing Symptoms

- Fresh app load with no save still shows `Command Rail`, sidebar navigation, topbar status, `Intel`, `Settings`, or global `Start` button.
- Fresh start screen still exposes `Resize sidebar`.
- `Browse All Athletes` is missing after opening the new career modal.
- `Browse All Athletes` opens but cannot be scrolled, searched, or used to select a player.
- Confirming a career without selecting a player creates a save with the default selected player.
- The selected athlete in the modal differs from `career.program.managedPlayerId` after save creation.

### Passing Symptoms

- Fresh app load with no active save shows only the start screen experience.
- No `banner`, `Primary command sidebar`, `Command Rail`, or `Resize sidebar` is present before a save/run exists.
- Starting a new career opens the athlete selection modal and `Confirm Career Athlete` is disabled until selection.
- `Browse All Athletes` opens a usable roster browser.
- Selecting an athlete from the browser enables confirmation.
- After confirmation, the career shell appears and the saved managed athlete matches the chosen player.
- Reloading preserves the chosen career athlete.

### Verification

Update e2e expectations that currently assume the sidebar exists on the start screen. The new expectation should be:

```ts
await expect(page.getByRole("heading", { name: "Start Screen" })).toBeVisible();
await expect(page.getByRole("banner")).toHaveCount(0);
await expect(page.getByRole("navigation", { name: "Primary commands" })).toHaveCount(0);
await expect(page.getByRole("button", { name: "Resize sidebar" })).toHaveCount(0);
```

Then keep the existing athlete-lock assertions after a career is created.

## 12. Cross-Issue Acceptance Checklist

The implementation is complete only when all of the following are true:

- All unlocked catalog events can be entered, advanced to their start date, opened, and played.
- Calendar Upcoming and Past Events each show at most five records per page.
- Expired events no longer consume Upcoming space.
- Past Events reads real `career.eventHistory` data.
- `View Entry` and `View Draw` have visible behavior.
- Sidebar bottom context, tactic, and managed-athlete blocks are gone.
- Portal Home no longer has an in-page green `Continue` button.
- Fresh start with no save has no topbar or sidebar.
- Browse All Athletes works during new career creation.
- Only `Summit Invitational` and `Continental Premier` keep competition locks during MVP.
- `Season Finals` is week 52.
- New fictional events fill the calendar gap and are testable.

## 13. Suggested Test Command Sequence

Run these after implementation:

```bash
npm run typecheck
npm run test -- tests/unit/career.test.ts tests/unit/career-daily-action.test.ts tests/unit/app-career-shell.test.tsx tests/unit/setup-view.test.tsx tests/unit/career-calendar-ranking.test.ts
npm run test:e2e
npm run build
```

If time is short, the minimum rescue proof is:

```bash
npm run typecheck
npm run test -- tests/unit/career.test.ts tests/unit/app-career-shell.test.tsx tests/unit/setup-view.test.tsx
```

## 14. Contractor Notes

Keep the domain rule below the UI. React should ask the career/event helpers what is due; it should not invent its own calendar truth. The clean dependency direction remains:

$$
\text{React UI} \rightarrow \text{intent} \rightarrow \text{career/store helpers} \rightarrow \text{state + route}
$$

Do not solve the event-entry bug by adding special cases for `Metro Open` or `National Command Championship`. The correct fix is event-id-safe scheduling plus table-driven tests over the catalog. If the fix only works for one named event, it is not a Plan 3 pass.
